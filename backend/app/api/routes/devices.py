import json
from datetime import datetime
from typing import Any, Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field, field_validator

from app.api.routes.dashboard import (
    create_ssl_context,
    get_database_url,
    should_use_ssl,
)
from app.security import require_permission

router = APIRouter()


class DeviceUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: str = Field(min_length=1, max_length=80)
    category: str = Field(min_length=1, max_length=80)
    model: str | None = Field(default=None, max_length=120)
    manufacturer: str | None = Field(default=None, max_length=120)
    serial_number: str | None = Field(default=None, max_length=120)
    install_date: datetime | None = None
    region_id: str | None = None
    location: dict[str, Any] | None = None
    realtime_status: Literal["online", "offline", "alarm", "fault", "maintenance"]

    @field_validator("name", "type", "category")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("field must not be blank")
        return stripped

    @field_validator("model", "manufacturer", "serial_number")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


def isoformat_or_none(value):
    return value.isoformat() if value else None


def build_alarm_item(row: asyncpg.Record) -> dict:
    return {
        "id": row["id"],
        "type": row["type"],
        "level": row["level"],
        "status": row["status"],
        "time": isoformat_or_none(row["time"]),
        "description": row["description"],
    }


@router.get("/overview")
async def get_devices_overview():
    database_url = get_database_url()

    if not database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL or SUPABASE_DB_URL is not configured",
        )

    query = """
        select
          d.id,
          d.name,
          d.type,
          d.category,
          d.model,
          d.manufacturer,
          d.serial_number,
          d.install_date,
          d.region_id,
          d.location,
          d.created_at,
          area.name as area_name,
          dr.status,
          dr.battery,
          dr.signal_strength,
          dr.cpu_usage,
          dr.temperature,
          dr.last_heartbeat,
          dr.health_score,
          dm.department as maintenance_department,
          dm.maintenance_level,
          dm.inspect_cycle_days,
          dm.last_inspect_time,
          dm.next_inspect_time,
          dm.last_repair_time,
          dm.repair_count,
          dm.maintenance_status,
          dm.remark as maintenance_remark,
          maintainer.name as maintainer_name,
          dc.inspection_required,
          dc.inspection_type,
          dc.inspection_cycle_months,
          dc.last_inspection_time,
          dc.next_inspection_time,
          dc.inspection_status,
          dc.inspection_agency,
          dc.certificate_no,
          dc.risk_level as compliance_risk_level,
          coalesce(alarm_counts.alarm_count, 0) as alarm_count,
          coalesce(alarm_counts.open_alarm_count, 0) as open_alarm_count
        from public.device d
        left join public.area area on area.id = d.region_id
        left join public.device_realtime dr on dr.device_id = d.id
        left join public.device_maintenance dm on dm.device_id = d.id
        left join public.person maintainer on maintainer.id = dm.maintainer_id
        left join public.device_compliance dc on dc.device_id = d.id
        left join lateral (
          select
            count(*) as alarm_count,
            count(*) filter (where a.status not in ('关闭', '误报')) as open_alarm_count
          from public.alarm a
          where a.device_id = d.id
        ) alarm_counts on true
        order by d.created_at desc, d.id;
    """

    alarm_query = """
        select id, type, level, status, "time", description
        from public.alarm
        where device_id = $1
        order by "time" desc, create_time desc
        limit 3;
    """

    try:
        connection = await asyncpg.connect(
            database_url,
            ssl=create_ssl_context() if should_use_ssl(database_url) else False,
        )
        rows = await connection.fetch(query)
        alarm_rows_by_device = {
            row["id"]: await connection.fetch(alarm_query, row["id"])
            for row in rows
        }
    except Exception as exc:
        print(f"Failed to load devices overview: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load devices overview",
        ) from exc
    finally:
        if "connection" in locals():
            await connection.close()

    return {
        "items": [
            {
                "id": row["id"],
                "name": row["name"],
                "type": row["type"],
                "category": row["category"],
                "model": row["model"],
                "manufacturer": row["manufacturer"],
                "serial_number": row["serial_number"],
                "install_date": isoformat_or_none(row["install_date"]),
                "region_id": row["region_id"],
                "location": row["location"],
                "created_at": isoformat_or_none(row["created_at"]),
                "area_name": row["area_name"],
                "realtime": {
                    "status": row["status"],
                    "battery": row["battery"],
                    "signal_strength": row["signal_strength"],
                    "cpu_usage": row["cpu_usage"],
                    "temperature": row["temperature"],
                    "last_heartbeat": isoformat_or_none(row["last_heartbeat"]),
                    "health_score": row["health_score"],
                },
                "maintenance": {
                    "department": row["maintenance_department"],
                    "level": row["maintenance_level"],
                    "inspect_cycle_days": row["inspect_cycle_days"],
                    "last_inspect_time": isoformat_or_none(row["last_inspect_time"]),
                    "next_inspect_time": isoformat_or_none(row["next_inspect_time"]),
                    "last_repair_time": isoformat_or_none(row["last_repair_time"]),
                    "repair_count": row["repair_count"],
                    "status": row["maintenance_status"],
                    "remark": row["maintenance_remark"],
                    "maintainer_name": row["maintainer_name"],
                },
                "compliance": {
                    "inspection_required": row["inspection_required"],
                    "inspection_type": row["inspection_type"],
                    "inspection_cycle_months": row["inspection_cycle_months"],
                    "last_inspection_time": isoformat_or_none(row["last_inspection_time"]),
                    "next_inspection_time": isoformat_or_none(row["next_inspection_time"]),
                    "inspection_status": row["inspection_status"],
                    "inspection_agency": row["inspection_agency"],
                    "certificate_no": row["certificate_no"],
                    "risk_level": row["compliance_risk_level"],
                },
                "alarm_count": row["alarm_count"],
                "open_alarm_count": row["open_alarm_count"],
                "recent_alarms": [
                    build_alarm_item(alarm_row)
                    for alarm_row in alarm_rows_by_device.get(row["id"], [])
                ],
            }
            for row in rows
        ]
    }


@router.put("/{device_id}", dependencies=[Depends(require_permission("devices.edit"))])
async def update_device(device_id: str, payload: DeviceUpdate):
    database_url = get_database_url()
    if not database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL or SUPABASE_DB_URL is not configured",
        )

    try:
        connection = await asyncpg.connect(
            database_url,
            ssl=create_ssl_context() if should_use_ssl(database_url) else False,
        )
        async with connection.transaction():
            if payload.region_id:
                area_exists = await connection.fetchval(
                    "select exists(select 1 from public.area where id = $1);",
                    payload.region_id,
                )
                if not area_exists:
                    raise HTTPException(status_code=422, detail="所属区域不存在")

            updated_id = await connection.fetchval(
                """
                update public.device
                set name = $2,
                    type = $3,
                    category = $4,
                    model = $5,
                    manufacturer = $6,
                    serial_number = $7,
                    install_date = $8,
                    region_id = $9,
                    location = $10::jsonb
                where id = $1
                returning id;
                """,
                device_id,
                payload.name,
                payload.type,
                payload.category,
                payload.model,
                payload.manufacturer,
                payload.serial_number,
                payload.install_date,
                payload.region_id,
                json.dumps(payload.location) if payload.location is not None else None,
            )
            if not updated_id:
                raise HTTPException(status_code=404, detail="设备不存在")

            await connection.execute(
                """
                insert into public.device_realtime (device_id, status, last_heartbeat)
                values ($1, $2, now())
                on conflict (device_id) do update
                set status = excluded.status,
                    last_heartbeat = excluded.last_heartbeat;
                """,
                device_id,
                payload.realtime_status,
            )
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Failed to update device: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to update device",
        ) from exc
    finally:
        if "connection" in locals():
            await connection.close()

    return {"id": device_id, "updated": True}


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_permission("devices.delete"))])
async def delete_device(device_id: str):
    database_url = get_database_url()
    if not database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL or SUPABASE_DB_URL is not configured",
        )

    try:
        connection = await asyncpg.connect(
            database_url,
            ssl=create_ssl_context() if should_use_ssl(database_url) else False,
        )
        deleted_id = await connection.fetchval(
            "delete from public.device where id = $1 returning id;",
            device_id,
        )
        if not deleted_id:
            raise HTTPException(status_code=404, detail="设备不存在")
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Failed to delete device: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to delete device",
        ) from exc
    finally:
        if "connection" in locals():
            await connection.close()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
