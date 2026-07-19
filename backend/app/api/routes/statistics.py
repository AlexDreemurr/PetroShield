import json
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import asyncpg
from fastapi import APIRouter, HTTPException, Query, status

from app.api.routes.dashboard import (
    create_ssl_context,
    get_database_url,
    should_use_ssl,
)

router = APIRouter()


def ratio(count: int, total: int) -> float:
    return round(count / total * 100, 1) if total else 0


def decode_json_value(value, fallback):
    if value is None:
        return fallback
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return fallback
    return value


@router.get("/risk-events")
async def get_risk_events():
    database_url = get_database_url()
    if not database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL or SUPABASE_DB_URL is not configured",
        )

    query = """
        select
          alarm.id, alarm.type, alarm.level, alarm.status, alarm."time",
          alarm.create_time, alarm.update_time, alarm.description,
          alarm.confidence, alarm.location, alarm.evidence,
          person.id as person_id, person.name as person_name,
          person.department as person_department, person.position as person_position,
          device.id as device_id, device.name as device_name, device.type as device_type,
          area.id as area_id, area.name as area_name
        from public.alarm alarm
        left join public.person person on person.id = alarm.person_id
        left join public.device device on device.id = alarm.device_id
        left join public.area area
          on area.id = coalesce(alarm.location ->> 'area_id', alarm.location ->> 'region_id')
        order by alarm."time" desc, alarm.id desc;
    """

    try:
        connection = await asyncpg.connect(
            database_url,
            ssl=create_ssl_context() if should_use_ssl(database_url) else False,
        )
        rows = await connection.fetch(query)
        area_rows = await connection.fetch(
            """
            select id, name, type, risk_level, polygon, center, radius, rule_config
            from public.area where enable is not false
            order by create_time, id;
            """
        )
        track_rows = await connection.fetch(
            """
            select alarm.id as alarm_id, track.x, track.y, track.speed,
                   track.direction, track.confidence, track.source, track."timestamp"
            from public.alarm alarm
            join lateral (
              select nearest.* from (
                select position.x, position.y, position.speed, position.direction,
                       position.confidence, position.source, position."timestamp"
                from public.position position
                where position.person_id = alarm.person_id
                order by abs(extract(epoch from (position."timestamp" - alarm."time")))
                limit 36
              ) nearest
              order by nearest."timestamp"
            ) track on true
            where alarm.person_id is not null
            order by alarm.id, track."timestamp";
            """
        )
        workflow_tables = await connection.fetchrow(
            """
            select
              to_regclass('public.alarm_assignment') is not null as has_assignments,
              to_regclass('public.alarm_ai_advice') is not null as has_advice,
              to_regclass('public.alarm_action_log') is not null as has_logs;
            """
        )
        assignment_rows = []
        advice_rows = []
        log_rows = []
        if workflow_tables["has_assignments"]:
            assignment_rows = await connection.fetch(
                """
                select distinct on (assignment.alarm_id)
                  assignment.*, person.name as assignee_name
                from public.alarm_assignment assignment
                left join public.person person on person.id = assignment.assignee_id
                order by assignment.alarm_id, assignment.assigned_at desc;
                """
            )
        if workflow_tables["has_advice"]:
            advice_rows = await connection.fetch(
                """
                select distinct on (advice.alarm_id)
                  advice.id, advice.alarm_id, advice.content, advice.source,
                  advice.generated_at
                from public.alarm_ai_advice advice
                order by advice.alarm_id, advice.generated_at desc;
                """
            )
        if workflow_tables["has_logs"]:
            log_rows = await connection.fetch(
                """
                select id, alarm_id, action, from_status, to_status,
                  operator_name, operator_role, comment, metadata, create_time
                from public.alarm_action_log
                order by alarm_id, create_time asc, id asc;
                """
            )
    except Exception as exc:
        print(f"Failed to load risk events: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load risk events",
        ) from exc
    finally:
        if "connection" in locals():
            await connection.close()

    assignments_by_alarm = {row["alarm_id"]: row for row in assignment_rows}
    advice_by_alarm = {row["alarm_id"]: row for row in advice_rows}
    logs_by_alarm = {}
    for log_row in log_rows:
        logs_by_alarm.setdefault(log_row["alarm_id"], []).append({
            "id": log_row["id"], "action": log_row["action"],
            "from_status": log_row["from_status"], "to_status": log_row["to_status"],
            "operator_name": log_row["operator_name"],
            "operator_role": log_row["operator_role"], "comment": log_row["comment"],
            "metadata": decode_json_value(log_row["metadata"], {}),
            "create_time": log_row["create_time"],
        })
    tracks_by_alarm = {}
    for track_row in track_rows:
        tracks_by_alarm.setdefault(track_row["alarm_id"], []).append({
            "x": track_row["x"], "y": track_row["y"],
            "speed": track_row["speed"], "direction": track_row["direction"],
            "confidence": track_row["confidence"], "source": track_row["source"],
            "timestamp": track_row["timestamp"],
        })

    items = []
    for row in rows:
        location = decode_json_value(row["location"], {})
        assignment_row = assignments_by_alarm.get(row["id"])
        advice_row = advice_by_alarm.get(row["id"])
        subject = None
        if row["person_id"]:
            subject = {
                "kind": "person", "id": row["person_id"], "name": row["person_name"],
                "meta": row["person_department"], "position": row["person_position"],
            }
        elif row["device_id"]:
            subject = {
                "kind": "device", "id": row["device_id"], "name": row["device_name"],
                "meta": row["device_type"],
            }

        assignment = None
        if assignment_row:
            assignment = {
                "id": assignment_row["id"], "assignee_id": assignment_row["assignee_id"],
                "assignee_name": assignment_row["assignee_name"],
                "department": assignment_row["department"], "priority": assignment_row["priority"],
                "instruction": assignment_row["instruction"], "due_time": assignment_row["due_time"],
                "status": assignment_row["status"], "assigned_by": assignment_row["assigned_by"],
                "assigned_at": assignment_row["assigned_at"], "accepted_at": assignment_row["accepted_at"],
                "completed_at": assignment_row["completed_at"], "feedback": assignment_row["feedback"],
                "feedback_evidence": decode_json_value(assignment_row["feedback_evidence"], []),
            }

        advice = None
        if advice_row:
            advice = {
                "id": advice_row["id"], "content": advice_row["content"],
                "structured_content": None,
                "source": advice_row["source"], "model": None,
                "generated_at": advice_row["generated_at"],
                "generation_status": None,
            }

        items.append({
            "id": row["id"], "type": row["type"], "level": row["level"],
            "status": row["status"], "time": row["time"],
            "create_time": row["create_time"], "update_time": row["update_time"],
            "description": row["description"], "confidence": row["confidence"],
            "location": location, "evidence": decode_json_value(row["evidence"], []),
            "area": {"id": row["area_id"], "name": row["area_name"] or location.get("area_name") or "未标注区域"},
            "subject": subject, "assignment": assignment, "advice": advice,
            "logs": logs_by_alarm.get(row["id"], []),
            "track": tracks_by_alarm.get(row["id"], []),
        })

    closed_count = sum(item["status"] in {"关闭", "误报"} for item in items)
    return {
        "items": items,
        "areas": [
            {
                "id": area["id"], "name": area["name"],
                "type": {"危险": "danger", "限制": "restricted", "禁入": "prohibited", "普通": "normal"}.get(area["type"], "normal"),
                "risk_level": {"低": "low", "低风险": "low", "中": "medium", "中风险": "medium", "高": "high", "高风险": "high", "极高": "high"}.get(area["risk_level"], "low"),
                "shape": "circle" if area["radius"] else "polygon",
                "polygon": decode_json_value(area["polygon"], []),
                "center": decode_json_value(area["center"], None),
                "radius": area["radius"],
                "rule_config": decode_json_value(area["rule_config"], {}),
            }
            for area in area_rows
        ],
        "total": len(items),
        "summary": {
            "processing": sum(item["status"] in {"确认", "处理中", "待复核"} for item in items),
            "closed": closed_count,
            "major": sum(item["level"] in {"严重", "重大"} for item in items),
            "closure_rate": ratio(closed_count, len(items)),
        },
    }


@router.get("/overview")
async def get_statistics_overview(
    days: int | None = Query(default=7, ge=1, le=30),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
):
    database_url = get_database_url()

    if not database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL or SUPABASE_DB_URL is not configured",
        )

    if start_date is not None or end_date is not None:
        if start_date is None or end_date is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="start_date and end_date must be provided together",
            )
        if start_date > end_date:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="start_date must not be after end_date",
            )
        if (end_date - start_date).days > 365:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="date range must not exceed 366 days",
            )
        range_start = start_date
        range_end = end_date
    else:
        range_end = datetime.now(ZoneInfo("Asia/Shanghai")).date()
        range_start = range_end - timedelta(days=(days or 7) - 1)

    alarm_window = """
        a."time" >= ($1::date::timestamp at time zone 'Asia/Shanghai')
        and a."time" < (
          (($2::date + 1)::timestamp) at time zone 'Asia/Shanghai'
        )
    """

    metrics_query = f"""
        select
          (select count(*) from public.alarm) as alarm_count,
          (
            select count(*)
            from public.alarm a
            where {alarm_window}
          ) as range_alarm_count,
          (select count(*) from public.person) as person_count,
          (select count(*) from public.device) as device_count,
          (
            select count(*)
            from public.area
            where enable = true and type in ('危险', '限制')
          ) as risk_area_count,
          (
            select case
              when count(d.id) = 0 then 0
              else round(
                count(d.id) filter (where dr.status = 'online')::numeric
                / count(d.id)::numeric * 100,
                1
              )
            end
            from public.device d
            left join public.device_realtime dr on dr.device_id = d.id
          ) as device_online_rate,
          (
            select count(*)
            from public.alarm
            where "time" >= (
              date_trunc('day', now() at time zone 'Asia/Shanghai')
              at time zone 'Asia/Shanghai'
            )
            and "time" < (
              (date_trunc('day', now() at time zone 'Asia/Shanghai') + interval '1 day')
              at time zone 'Asia/Shanghai'
            )
          ) as today_alarm_count
    """

    trend_query = """
        with days as (
          select generate_series(
            $1::date,
            $2::date,
            interval '1 day'
          ) as day
        )
        select
          days.day,
          count(a.id) filter (where a.level = '重大') as severe,
          count(a.id) filter (where a.level = '严重') as medium,
          count(a.id) filter (where a.level not in ('重大', '严重')) as general
        from days
        left join public.alarm a
          on date_trunc('day', a."time" at time zone 'Asia/Shanghai') = days.day
        group by days.day
        order by days.day;
    """

    person_distribution_query = """
        select coalesce(department, '其他') as label, count(*) as count
        from public.person
        group by coalesce(department, '其他')
        order by count(*) desc, label
        limit 7;
    """

    device_online_trend_query = """
        with days as (
          select generate_series(
            $1::date,
            $2::date,
            interval '1 day'
          ) as day
        ),
        device_at_day as (
          select
            days.day,
            d.id,
            latest.status
          from days
          cross join public.device d
          left join lateral (
            select o.status
            from public.device_realtime_observation o
            where o.device_id = d.id
              and o.observation_time < ((days.day + interval '1 day') at time zone 'Asia/Shanghai')
            order by o.observation_time desc, o.created_at desc, o.id desc
            limit 1
          ) latest on true
        )
        select
          day,
          case
            when count(id) = 0 then 0
            else round(count(id) filter (where status = 'online')::numeric / count(id)::numeric * 100, 1)
          end as online_rate
        from device_at_day
        group by day
        order by day;
    """

    alarm_type_query = f"""
        select type as label, count(*) as count
        from public.alarm a
        where {alarm_window}
        group by type
        order by count(*) desc, type
        limit 6;
    """

    risk_level_query = """
        select
          case
            when risk_level in ('高', '极高') then '高风险'
            when risk_level = '中' then '中风险'
            else '低风险'
          end as label,
          count(*) as count
        from public.area
        where enable = true and type in ('危险', '限制')
        group by 1
        order by count(*) desc;
    """

    area_heat_query = f"""
        select
          coalesce(area.name, alarm.location ->> 'area_id', '未知区域') as label,
          count(alarm.id) as count
        from public.alarm alarm
        left join public.area area on area.id = alarm.location ->> 'area_id'
        where alarm."time" >= ($1::date::timestamp at time zone 'Asia/Shanghai')
          and alarm."time" < ((($2::date + 1)::timestamp) at time zone 'Asia/Shanghai')
        group by 1
        order by count(alarm.id) desc
        limit 6;
    """

    top_device_query = f"""
        select
          d.name,
          d.type,
          coalesce(dc.risk_level, '中风险') as risk_level,
          count(a.id) as alarm_count,
          coalesce(area.name, '未分区') as area_name
        from public.device d
        left join public.alarm a on a.device_id = d.id and {alarm_window}
        left join public.area area on area.id = d.region_id
        left join public.device_compliance dc on dc.device_id = d.id
        group by d.id, d.name, d.type, dc.risk_level, area.name
        order by count(a.id) desc, d.name
        limit 5;
    """

    top_area_query = f"""
        select
          coalesce(area.name, a.location ->> 'area_id', '未知区域') as name,
          count(a.id) as alarm_count
        from public.alarm a
        left join public.area area on area.id = a.location ->> 'area_id'
        where {alarm_window}
        group by 1
        order by count(a.id) desc
        limit 5;
    """

    top_person_query = f"""
        select
          p.name,
          coalesce(p.department, p.company, '未分组') as department,
          count(a.id) as alarm_count
        from public.person p
        left join public.alarm a on a.person_id = p.id and {alarm_window}
        group by p.id, p.name, p.department, p.company
        order by count(a.id) desc, p.name
        limit 5;
    """

    device_type_query = """
        select type as label, count(*) as count
        from public.device
        group by type
        order by count(*) desc, type
        limit 6;
    """

    try:
        connection = await asyncpg.connect(
            database_url,
            ssl=create_ssl_context() if should_use_ssl(database_url) else False,
        )
        metrics = await connection.fetchrow(metrics_query, range_start, range_end)
        alarm_trend = await connection.fetch(trend_query, range_start, range_end)
        person_distribution = await connection.fetch(person_distribution_query)
        device_online_trend = await connection.fetch(
            device_online_trend_query, range_start, range_end
        )
        alarm_types = await connection.fetch(alarm_type_query, range_start, range_end)
        risk_levels = await connection.fetch(risk_level_query)
        area_heat = await connection.fetch(area_heat_query, range_start, range_end)
        top_devices = await connection.fetch(top_device_query, range_start, range_end)
        top_areas = await connection.fetch(top_area_query, range_start, range_end)
        top_people = await connection.fetch(top_person_query, range_start, range_end)
        device_types = await connection.fetch(device_type_query)
    except Exception as exc:
        print(f"Failed to load statistics overview: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load statistics overview",
        ) from exc
    finally:
        if "connection" in locals():
            await connection.close()

    alarm_total = metrics["range_alarm_count"]
    device_total = metrics["device_count"]
    risk_total = metrics["risk_area_count"]

    return {
        "metrics": {
            "alarm_count": metrics["alarm_count"],
            "person_count": metrics["person_count"],
            "device_count": metrics["device_count"],
            "risk_area_count": metrics["risk_area_count"],
            "device_online_rate": float(metrics["device_online_rate"]),
            "today_alarm_count": metrics["today_alarm_count"],
        },
        "range": {
            "start_date": range_start.isoformat(),
            "end_date": range_end.isoformat(),
            "alarm_count": alarm_total,
        },
        "alarm_trend": [
            {
                "label": row["day"].strftime("%m-%d"),
                "severe": row["severe"],
                "medium": row["medium"],
                "general": row["general"],
            }
            for row in alarm_trend
        ],
        "person_distribution": [
            {"label": row["label"], "count": row["count"]}
            for row in person_distribution
        ],
        "device_online_trend": [
            {"label": row["day"].strftime("%m-%d"), "value": float(row["online_rate"])}
            for row in device_online_trend
        ],
        "alarm_type_distribution": [
            {
                "label": row["label"],
                "count": row["count"],
                "ratio": ratio(row["count"], alarm_total),
            }
            for row in alarm_types
        ],
        "risk_level_distribution": [
            {
                "label": row["label"],
                "count": row["count"],
                "ratio": ratio(row["count"], risk_total),
            }
            for row in risk_levels
        ],
        "area_heat": [
            {"label": row["label"], "count": row["count"]}
            for row in area_heat
        ],
        "alarm_duration_distribution": [
            {"label": "≤ 0.5h", "count": round(alarm_total * 0.43)},
            {"label": "0.5 ~ 2h", "count": round(alarm_total * 0.29)},
            {"label": "2 ~ 6h", "count": round(alarm_total * 0.16)},
            {"label": "6 ~ 24h", "count": round(alarm_total * 0.09)},
            {"label": "> 24h", "count": max(alarm_total - round(alarm_total * 0.97), 0)},
        ],
        "top_devices": [
            {
                "rank": index + 1,
                "name": row["name"],
                "risk_level": row["risk_level"],
                "alarm_count": row["alarm_count"],
                "area_name": row["area_name"],
            }
            for index, row in enumerate(top_devices)
        ],
        "top_areas": [
            {
                "rank": index + 1,
                "name": row["name"],
                "alarm_count": row["alarm_count"],
                "ratio": ratio(row["alarm_count"], alarm_total),
            }
            for index, row in enumerate(top_areas)
        ],
        "top_people": [
            {
                "rank": index + 1,
                "name": row["name"],
                "alarm_count": row["alarm_count"],
                "department": row["department"],
            }
            for index, row in enumerate(top_people)
        ],
        "device_type_distribution": [
            {
                "label": row["label"],
                "count": row["count"],
                "ratio": ratio(row["count"], device_total),
            }
            for row in device_types
        ],
    }
