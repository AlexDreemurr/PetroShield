import json
from datetime import date, datetime
from typing import Literal

import asyncpg
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.api.routes.risk_control import (
    AREA_TYPE_FROM_DB,
    RISK_LEVEL_FROM_DB,
    connect_database,
    decode_json,
)

router = APIRouter()


class AlarmAction(BaseModel):
    action: Literal[
        "confirm",
        "mark_false_positive",
        "dispatch",
        "submit_feedback",
        "review_approve",
        "review_reject",
        "close",
    ]
    operator_name: str = Field(default="张三", min_length=1, max_length=100)
    operator_role: str = Field(default="运营管理员", max_length=100)
    comment: str | None = Field(default=None, max_length=1000)
    assignee_id: str | None = None
    department: str | None = Field(default=None, max_length=100)
    priority: Literal["low", "medium", "high", "urgent"] = "medium"
    instruction: str | None = Field(default=None, max_length=1000)
    due_time: datetime | None = None
    evidence: list[dict] = Field(default_factory=list)


def build_subject(row: asyncpg.Record) -> dict | None:
    if row["person_id"]:
        return {
            "kind": "person",
            "id": row["person_id"],
            "name": row["person_name"],
            "meta": row["person_department"] or row["person_company"],
            "position": row["person_position"],
        }
    if row["device_id"]:
        return {
            "kind": "device",
            "id": row["device_id"],
            "name": row["device_name"],
            "meta": row["device_type"],
        }
    return None


def build_alarm_item(row: asyncpg.Record) -> dict:
    location = decode_json(row["location"], {})
    return {
        "id": row["id"],
        "type": row["type"],
        "level": row["level"],
        "status": row["status"],
        "time": row["time"],
        "description": row["description"],
        "confidence": row["confidence"],
        "location": location,
        "area": {
            "id": row["area_id"],
            "name": row["area_name"] or location.get("area_name") or "未标注区域",
        },
        "subject": build_subject(row),
    }


ALARM_BASE_QUERY = """
    select
      alarm.id, alarm.type, alarm.level, alarm.location, alarm."time",
      alarm.status, alarm.person_id, alarm.device_id, alarm.confidence,
      alarm.description, alarm.evidence, alarm.create_time, alarm.update_time,
      person.name as person_name,
      person.department as person_department,
      person.company as person_company,
      person.position as person_position,
      device.name as device_name,
      device.type as device_type,
      area.id as area_id,
      area.name as area_name
    from public.alarm alarm
    left join public.person person on person.id = alarm.person_id
    left join public.device device on device.id = alarm.device_id
    left join public.area area on area.id = alarm.location ->> 'area_id'
"""


async def fetch_alarm_row(connection: asyncpg.Connection, alarm_id: str):
    row = await connection.fetchrow(
        ALARM_BASE_QUERY + " where alarm.id = $1;", alarm_id
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Alarm not found"
        )
    return row


@router.get("")
async def list_alarms(
    start_date: date | None = None,
    end_date: date | None = None,
    alarm_type: str | None = None,
    level: str | None = None,
    alarm_status: str | None = Query(default=None, alias="status"),
    keyword: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=5, le=50),
):
    where_sql = """
      where ($1::date is null or alarm."time" >= ($1::date::timestamp at time zone 'Asia/Shanghai'))
        and ($2::date is null or alarm."time" < (($2::date + 1)::timestamp at time zone 'Asia/Shanghai'))
        and ($3::text is null or alarm.type = $3)
        and ($4::text is null or alarm.level = $4)
        and ($5::text is null or alarm.status = $5)
        and (
          $6::text is null
          or alarm.id ilike '%' || $6 || '%'
          or alarm.description ilike '%' || $6 || '%'
          or person.name ilike '%' || $6 || '%'
          or device.name ilike '%' || $6 || '%'
          or area.name ilike '%' || $6 || '%'
        )
    """
    params = [start_date, end_date, alarm_type, level, alarm_status, keyword or None]
    try:
        connection = await connect_database()
        total = await connection.fetchval(
            "select count(*) from (" + ALARM_BASE_QUERY + where_sql + ") filtered",
            *params,
        )
        rows = await connection.fetch(
            ALARM_BASE_QUERY
            + where_sql
            + " order by alarm.\"time\" desc, alarm.id desc limit $7 offset $8;",
            *params,
            page_size,
            (page - 1) * page_size,
        )
        option_rows = await connection.fetch(
            """
            select 'type' as kind, type as value from public.alarm group by type
            union all
            select 'level', level from public.alarm group by level
            union all
            select 'status', status from public.alarm group by status
            order by kind, value;
            """
        )
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Failed to list alarms: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load alarms",
        ) from exc
    finally:
        if "connection" in locals():
            await connection.close()

    options = {"types": [], "levels": [], "statuses": []}
    option_keys = {"type": "types", "level": "levels", "status": "statuses"}
    for row in option_rows:
        options[option_keys[row["kind"]]].append(row["value"])
    return {
        "items": [build_alarm_item(row) for row in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "options": options,
    }


@router.get("/operators")
async def list_alarm_operators():
    try:
        connection = await connect_database()
        rows = await connection.fetch(
            """
            select id, name, department, position
            from public.person
            where status <> '离线'
            order by
              case when position like '%主管%' or position like '%班组长%' then 0 else 1 end,
              department, name;
            """
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load operators",
        ) from exc
    finally:
        if "connection" in locals():
            await connection.close()
    return {"items": [dict(row) for row in rows]}


@router.get("/{alarm_id}")
async def get_alarm_detail(alarm_id: str):
    try:
        connection = await connect_database()
        row = await fetch_alarm_row(connection, alarm_id)
        location = decode_json(row["location"], {})
        area_id = location.get("area_id")
        area_row = await connection.fetchrow(
            """
            select id, name, type, polygon, center, radius, rule_config, risk_level
            from public.area where id = $1;
            """,
            area_id,
        )
        assignment_row = await connection.fetchrow(
            """
            select assignment.*, person.name as assignee_name,
                   person.position as assignee_position
            from public.alarm_assignment assignment
            left join public.person person on person.id = assignment.assignee_id
            where assignment.alarm_id = $1
            order by assignment.assigned_at desc limit 1;
            """,
            alarm_id,
        )
        advice_row = await connection.fetchrow(
            """
            select * from public.alarm_ai_advice
            where alarm_id = $1 order by generated_at desc limit 1;
            """,
            alarm_id,
        )
        log_rows = await connection.fetch(
            """
            select * from public.alarm_action_log
            where alarm_id = $1 order by create_time asc, id asc;
            """,
            alarm_id,
        )
        resource_rows = await connection.fetch(
            """
            select device.id, device.name, device.type, device.category,
                   device.location, realtime.status
            from public.device device
            left join public.device_realtime realtime on realtime.device_id = device.id
            where device.region_id = $1
            order by case when device.type like '%摄像%' then 0 else 1 end,
                     device.name
            limit 12;
            """,
            area_id,
        )
        position_row = None
        if row["person_id"]:
            position_row = await connection.fetchrow(
                """
                select x, y, z, source, confidence, "timestamp"
                from public.person_position_current where person_id = $1;
                """,
                row["person_id"],
            )
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Failed to load alarm detail: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load alarm detail",
        ) from exc
    finally:
        if "connection" in locals():
            await connection.close()

    detail = build_alarm_item(row)
    detail["evidence"] = decode_json(row["evidence"], {})
    detail["create_time"] = row["create_time"]
    detail["update_time"] = row["update_time"]
    detail["area"] = None
    if area_row:
        config = decode_json(area_row["rule_config"], {})
        detail["area"] = {
            "id": area_row["id"],
            "name": area_row["name"],
            "type": AREA_TYPE_FROM_DB.get(area_row["type"], "normal"),
            "risk_level": RISK_LEVEL_FROM_DB.get(area_row["risk_level"], "low"),
            "shape": config.get("shape") or ("circle" if area_row["radius"] else "polygon"),
            "polygon": decode_json(area_row["polygon"], []),
            "center": decode_json(area_row["center"], None),
            "radius": area_row["radius"],
        }
    detail["position"] = dict(position_row) if position_row else location
    detail["assignment"] = None
    if assignment_row:
        detail["assignment"] = dict(assignment_row)
        detail["assignment"]["feedback_evidence"] = decode_json(
            assignment_row["feedback_evidence"], []
        )
    detail["ai_advice"] = dict(advice_row) if advice_row else None
    detail["logs"] = []
    for log in log_rows:
        item = dict(log)
        item["metadata"] = decode_json(log["metadata"], {})
        detail["logs"].append(item)
    detail["resources"] = []
    for resource in resource_rows:
        item = dict(resource)
        item["location"] = decode_json(resource["location"], {})
        detail["resources"].append(item)
    return detail


def build_ai_advice(alarm_type: str, level: str) -> str:
    advice = {
        "越界": "立即通知人员撤离限制区域，核验作业许可，并调取邻近摄像头确认现场状态。",
        "跌倒": "优先确认人员意识与生命体征，派遣就近救援力量，并保持视频通道畅通。",
        "设备异常": "隔离异常设备影响范围，核对实时测点和最近维护记录，安排专业人员现场复核。",
        "离线": "联系人员或现场负责人确认安全状态，检查定位标签电量、信号和绑定关系。",
    }.get(alarm_type, "复核告警证据和关联资源，组织现场确认并保留完整处置记录。")
    if level in {"严重", "重大"}:
        advice += " 该告警等级较高，应同步通知HSE值班负责人并设置处置时限。"
    return advice


@router.post("/{alarm_id}/actions")
async def perform_alarm_action(alarm_id: str, payload: AlarmAction):
    transitions = {
        "confirm": ({"新建"}, "确认"),
        "mark_false_positive": ({"新建", "确认"}, "误报"),
        "dispatch": ({"确认"}, "处理中"),
        "submit_feedback": ({"处理中"}, "待复核"),
        "review_approve": ({"待复核"}, "关闭"),
        "review_reject": ({"待复核"}, "处理中"),
        "close": ({"新建", "确认", "处理中", "待复核"}, "关闭"),
    }
    allowed_statuses, next_status = transitions[payload.action]
    if payload.action == "dispatch" and not payload.assignee_id:
        raise HTTPException(status_code=422, detail="Dispatch requires an assignee")
    if payload.action == "dispatch" and not payload.instruction:
        raise HTTPException(status_code=422, detail="Dispatch requires an instruction")
    if payload.action in {"submit_feedback", "review_reject"} and not payload.comment:
        raise HTTPException(status_code=422, detail="This action requires a comment")

    try:
        connection = await connect_database()
        async with connection.transaction():
            alarm = await connection.fetchrow(
                "select * from public.alarm where id = $1 for update;", alarm_id
            )
            if not alarm:
                raise HTTPException(status_code=404, detail="Alarm not found")
            current_status = alarm["status"]
            if current_status not in allowed_statuses:
                raise HTTPException(
                    status_code=409,
                    detail=f"Action {payload.action} is not allowed from {current_status}",
                )

            if payload.action == "confirm":
                await connection.execute(
                    """
                    insert into public.alarm_ai_advice (alarm_id, content)
                    values ($1, $2);
                    """,
                    alarm_id,
                    build_ai_advice(alarm["type"], alarm["level"]),
                )
            elif payload.action == "dispatch":
                await connection.execute(
                    """
                    insert into public.alarm_assignment (
                      alarm_id, assignee_id, department, priority, instruction,
                      due_time, assigned_by
                    ) values ($1, $2, $3, $4, $5, $6, $7);
                    """,
                    alarm_id,
                    payload.assignee_id,
                    payload.department,
                    payload.priority,
                    payload.instruction,
                    payload.due_time,
                    payload.operator_name,
                )
            elif payload.action == "submit_feedback":
                assignment_id = await connection.fetchval(
                    """
                    select id from public.alarm_assignment
                    where alarm_id = $1 and status <> 'cancelled'
                    order by assigned_at desc limit 1;
                    """,
                    alarm_id,
                )
                if not assignment_id:
                    raise HTTPException(status_code=409, detail="No active assignment")
                await connection.execute(
                    """
                    update public.alarm_assignment
                    set status = 'completed', completed_at = now(), feedback = $2,
                        feedback_evidence = $3::jsonb
                    where id = $1;
                    """,
                    assignment_id,
                    payload.comment,
                    json.dumps(payload.evidence),
                )
            elif payload.action == "review_reject":
                await connection.execute(
                    """
                    update public.alarm_assignment
                    set status = 'accepted', completed_at = null
                    where id = (
                      select id from public.alarm_assignment
                      where alarm_id = $1 order by assigned_at desc limit 1
                    );
                    """,
                    alarm_id,
                )

            await connection.execute(
                "update public.alarm set status = $2 where id = $1;",
                alarm_id,
                next_status,
            )
            await connection.execute(
                """
                insert into public.alarm_action_log (
                  alarm_id, action, from_status, to_status, operator_name,
                  operator_role, comment, metadata
                ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb);
                """,
                alarm_id,
                payload.action,
                current_status,
                next_status,
                payload.operator_name,
                payload.operator_role,
                payload.comment,
                json.dumps({"evidence": payload.evidence}),
            )
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Failed to perform alarm action: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to update alarm",
        ) from exc
    finally:
        if "connection" in locals():
            await connection.close()

    return await get_alarm_detail(alarm_id)

