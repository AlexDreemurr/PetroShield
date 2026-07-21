import json
from io import BytesIO
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, ValidationError

from app.api.routes.dashboard import (
    create_ssl_context,
    get_database_url,
    should_use_ssl,
)
from app.security import require_permission
from app.services.area_excel import (
    MAX_FILE_SIZE,
    AreaExcelError,
    build_area_template,
    parse_area_workbook,
)

router = APIRouter()

AREA_TYPE_TO_DB = {
    "danger": "危险",
    "restricted": "限制",
    "prohibited": "禁入",
    "normal": "普通",
}
AREA_TYPE_FROM_DB = {value: key for key, value in AREA_TYPE_TO_DB.items()}
RISK_LEVEL_TO_DB = {"low": "低", "medium": "中", "high": "高"}
RISK_LEVEL_FROM_DB = {
    "低": "low",
    "低风险": "low",
    "中": "medium",
    "中风险": "medium",
    "高": "high",
    "高风险": "high",
    "极高": "high",
}


class Coordinate(BaseModel):
    x: float
    y: float


class RiskRules(BaseModel):
    cross_boundary: bool = True
    dwell_enabled: bool = False
    dwell_minutes: int = Field(default=30, ge=1, le=1440)
    capacity_enabled: bool = False
    max_people: int = Field(default=10, ge=0, le=10000)
    priority: Literal["low", "medium", "high", "urgent"] = "medium"


class AreaWrite(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: Literal["danger", "restricted", "prohibited", "normal"]
    risk_level: Literal["low", "medium", "high"]
    shape: Literal["polygon", "circle"]
    polygon: list[Coordinate] = Field(default_factory=list)
    center: Coordinate | None = None
    radius: float | None = Field(default=None, ge=0)
    enabled: bool = True
    manager_name: str | None = Field(default=None, max_length=100)
    manager_department: str | None = Field(default=None, max_length=100)
    rules: RiskRules


def decode_json(value, fallback):
    if value is None:
        return fallback
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return fallback
    return value


def validate_geometry(payload: AreaWrite) -> None:
    if payload.shape == "polygon" and len(payload.polygon) < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Polygon areas require at least three points",
        )
    if payload.shape == "circle" and (
        payload.center is None or payload.radius is None or payload.radius <= 0
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Circle areas require a center and positive radius",
        )


def build_rule_config(payload: AreaWrite) -> dict:
    return {
        "shape": payload.shape,
        "alarm_on_cross": payload.rules.cross_boundary,
        "cross_boundary": payload.rules.cross_boundary,
        "dwell_enabled": payload.rules.dwell_enabled,
        "max_stay_minutes": payload.rules.dwell_minutes,
        "dwell_minutes": payload.rules.dwell_minutes,
        "capacity_enabled": payload.rules.capacity_enabled,
        "max_people": payload.rules.max_people,
        "priority": payload.rules.priority,
        "manager_name": payload.manager_name,
        "manager_department": payload.manager_department,
    }


def build_area_item(row: asyncpg.Record) -> dict:
    polygon = decode_json(row["polygon"], [])
    center = decode_json(row["center"], None)
    config = decode_json(row["rule_config"], {})
    shape = config.get("shape") or ("circle" if row["radius"] else "polygon")
    manager_name = config.get("manager_name") or row["device_manager_name"]
    manager_department = (
        config.get("manager_department") or row["device_manager_department"]
    )
    dwell_minutes = config.get(
        "dwell_minutes", config.get("max_stay_minutes", 30)
    )
    max_people = config.get("max_people", 10)

    return {
        "id": row["id"],
        "name": row["name"],
        "type": AREA_TYPE_FROM_DB.get(row["type"], "normal"),
        "risk_level": RISK_LEVEL_FROM_DB.get(row["risk_level"], "low"),
        "shape": shape,
        "polygon": polygon,
        "center": center,
        "radius": row["radius"],
        "enabled": row["enable"],
        "manager": {
            "id": row["device_manager_id"],
            "name": manager_name or "待指定",
            "department": manager_department or "待指定",
        },
        "people_count": row["people_count"],
        "device_count": row["device_count"],
        "alert_count": row["alert_count"],
        "rules": {
            "cross_boundary": bool(
                config.get("cross_boundary", config.get("alarm_on_cross", False))
            ),
            "dwell_enabled": bool(
                config.get("dwell_enabled", "max_stay_minutes" in config)
            ),
            "dwell_minutes": int(dwell_minutes or 30),
            "capacity_enabled": bool(
                config.get("capacity_enabled", "max_people" in config)
            ),
            "max_people": int(max_people or 0),
            "priority": config.get(
                "priority",
                "high" if row["risk_level"] in {"高", "高风险", "极高"} else "medium",
            ),
        },
    }


AREA_OVERVIEW_QUERY = """
    select
      area.id,
      area.name,
      area.type,
      area.polygon,
      area.center,
      area.radius,
      area.rule_config,
      area.risk_level,
      area.enable,
      coalesce(people.people_count, 0) as people_count,
      coalesce(devices.device_count, 0) as device_count,
      coalesce(alarms.alert_count, 0) as alert_count,
      manager.id as device_manager_id,
      manager.name as device_manager_name,
      manager.department as device_manager_department
    from public.area area
    left join lateral (
      select count(*) as people_count
      from public.person person
      where person.location_zone = area.name
    ) people on true
    left join lateral (
      select count(*) as device_count
      from public.device device
      where device.region_id = area.id
    ) devices on true
    left join lateral (
      select count(*) as alert_count
      from public.alarm alarm
      where alarm.location ->> 'area_id' = area.id
        and alarm.status not in ('关闭', '误报')
    ) alarms on true
    left join lateral (
      select
        person.id,
        person.name,
        coalesce(maintenance.department, person.department) as department
      from public.device device
      join public.device_maintenance maintenance
        on maintenance.device_id = device.id
      join public.person person on person.id = maintenance.maintainer_id
      where device.region_id = area.id
      order by device.id
      limit 1
    ) manager on true
    where ($1::text is null or area.id = $1)
    order by
      case area.type
        when '禁入' then 1
        when '危险' then 2
        when '限制' then 3
        else 4
      end,
      area.name;
"""


async def connect_database() -> asyncpg.Connection:
    database_url = get_database_url()
    if not database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL or SUPABASE_DB_URL is not configured",
        )
    return await asyncpg.connect(
        database_url,
        ssl=create_ssl_context() if should_use_ssl(database_url) else False,
    )


async def fetch_area(connection: asyncpg.Connection, area_id: str) -> dict:
    row = await connection.fetchrow(AREA_OVERVIEW_QUERY, area_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Area not found")
    return build_area_item(row)


async def insert_area(connection: asyncpg.Connection, payload: AreaWrite) -> str:
    rule_config = build_rule_config(payload)
    return await connection.fetchval(
        """
        insert into public.area (
          name, type, polygon, center, radius, rule_config, risk_level, enable
        ) values ($1, $2, $3::jsonb, $4::jsonb, $5, $6::jsonb, $7, $8)
        returning id;
        """,
        payload.name,
        AREA_TYPE_TO_DB[payload.type],
        json.dumps([point.model_dump() for point in payload.polygon]),
        json.dumps(payload.center.model_dump()) if payload.center else None,
        payload.radius if payload.shape == "circle" else None,
        json.dumps(rule_config),
        RISK_LEVEL_TO_DB[payload.risk_level],
        payload.enabled,
    )


@router.get("/overview")
async def get_risk_control_overview():
    try:
        connection = await connect_database()
        rows = await connection.fetch(AREA_OVERVIEW_QUERY, None)
        manager_rows = await connection.fetch(
            """
            select id, name, department
            from public.person
            where status <> '离线'
            order by name, id;
            """
        )
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Failed to load risk control overview: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load risk control overview",
        ) from exc
    finally:
        if "connection" in locals():
            await connection.close()

    return {
        "items": [build_area_item(row) for row in rows],
        "managers": [
            {
                "id": row["id"],
                "name": row["name"],
                "department": row["department"],
            }
            for row in manager_rows
        ],
    }


@router.post("/areas", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("risk.create"))])
async def create_area(payload: AreaWrite):
    validate_geometry(payload)

    try:
        connection = await connect_database()
        area_id = await insert_area(connection, payload)
        return await fetch_area(connection, area_id)
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Failed to create risk area: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to create risk area",
        ) from exc
    finally:
        if "connection" in locals():
            await connection.close()


@router.get("/areas/import-template", dependencies=[Depends(require_permission("risk.create"))])
async def download_area_import_template():
    content = build_area_template()
    return StreamingResponse(
        BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=petroshield-area-import-template.xlsx"},
    )


@router.post("/areas/import", dependencies=[Depends(require_permission("risk.create"))])
async def import_areas(
    mode: Literal["a", "w"] = Query(..., description="a 追加；w 覆盖"),
    file: UploadFile = File(...),
    user: dict = Depends(require_permission("risk.create")),
):
    if mode == "w" and "risk.delete" not in user["permissions"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="覆盖导入还需要 risk.delete 权限")
    filename = file.filename or ""
    if not filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="仅支持 .xlsx 文件")
    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="文件不能超过 5 MB")

    try:
        raw_areas = parse_area_workbook(content)
        areas = [AreaWrite.model_validate(item) for item in raw_areas]
        for area in areas:
            validate_geometry(area)
    except AreaExcelError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "区域表格校验失败", "errors": exc.errors}) from exc
    except ValidationError as exc:
        errors = [{"row": None, "field": ".".join(str(part) for part in error["loc"]), "message": error["msg"]} for error in exc.errors()]
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "区域表格校验失败", "errors": errors}) from exc

    connection = await connect_database()
    try:
        async with connection.transaction():
            existing_rows = await connection.fetch("select id, name from public.area for update")
            existing_names = {row["name"] for row in existing_rows}
            duplicate_names = sorted(existing_names.intersection(area.name for area in areas))
            if mode == "a" and duplicate_names:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={"message": "追加导入存在重名区域", "errors": [{"row": None, "field": "区域名称", "message": f"已存在：{'、'.join(duplicate_names[:20])}"}]},
                )

            removed_count = 0
            if mode == "w":
                removed_count = len(existing_rows)
                if existing_names:
                    await connection.execute(
                        "update public.person set location_zone = null where location_zone = any($1::text[])",
                        list(existing_names),
                    )
                await connection.execute("update public.device set region_id = null where region_id is not null")
                await connection.execute("delete from public.area")

            imported_ids = [await insert_area(connection, area) for area in areas]
        return {
            "mode": mode,
            "imported_count": len(imported_ids),
            "removed_count": removed_count,
            "area_ids": imported_ids,
            "message": f"已{'覆盖' if mode == 'w' else '追加'}导入 {len(imported_ids)} 个区域",
        }
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Failed to import risk areas: {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="区域导入失败，数据库未发生变更") from exc
    finally:
        await connection.close()


@router.put("/areas/{area_id}", dependencies=[Depends(require_permission("risk.edit"))])
async def update_area(area_id: str, payload: AreaWrite):
    validate_geometry(payload)
    rule_config = build_rule_config(payload)

    try:
        connection = await connect_database()
        updated_id = await connection.fetchval(
            """
            update public.area
            set
              name = $2,
              type = $3,
              polygon = $4::jsonb,
              center = $5::jsonb,
              radius = $6,
              rule_config = $7::jsonb,
              risk_level = $8,
              enable = $9
            where id = $1
            returning id;
            """,
            area_id,
            payload.name,
            AREA_TYPE_TO_DB[payload.type],
            json.dumps([point.model_dump() for point in payload.polygon]),
            json.dumps(payload.center.model_dump()) if payload.center else None,
            payload.radius if payload.shape == "circle" else None,
            json.dumps(rule_config),
            RISK_LEVEL_TO_DB[payload.risk_level],
            payload.enabled,
        )
        if not updated_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Area not found",
            )
        return await fetch_area(connection, updated_id)
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Failed to update risk area: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to update risk area",
        ) from exc
    finally:
        if "connection" in locals():
            await connection.close()


@router.delete("/areas/{area_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_permission("risk.delete"))])
async def delete_area(area_id: str):
    try:
        connection = await connect_database()
        async with connection.transaction():
            area_name = await connection.fetchval(
                "select name from public.area where id = $1 for update;",
                area_id,
            )
            if not area_name:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Area not found",
                )

            await connection.execute(
                "update public.person set location_zone = null where location_zone = $1;",
                area_name,
            )
            await connection.execute(
                "delete from public.area where id = $1;",
                area_id,
            )
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Failed to delete risk area: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to delete risk area",
        ) from exc
    finally:
        if "connection" in locals():
            await connection.close()
