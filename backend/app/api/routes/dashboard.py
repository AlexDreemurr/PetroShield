import os
import ssl
from urllib.parse import urlsplit

import asyncpg
from fastapi import APIRouter, HTTPException, status

router = APIRouter()


def get_database_url() -> str | None:
    return os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")


def should_use_ssl(database_url: str) -> bool:
    parsed = urlsplit(database_url)
    host = parsed.hostname or ""

    return host.endswith(".supabase.co") or "pooler.supabase.com" in host


def create_ssl_context() -> ssl.SSLContext | bool:
    verify_ssl = os.getenv("DB_SSL_VERIFY", "true").lower()

    if verify_ssl in {"0", "false", "no", "off"}:
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        return context

    return True


@router.get("/metrics")
async def get_dashboard_metrics():
    database_url = get_database_url()

    if not database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL or SUPABASE_DB_URL is not configured",
        )

    query = """
        with metrics as (
          select
            (
              select count(*)
              from public.person
              where status <> '离线'
            ) as online_person_count,
            (
              select count(*)
              from public.device
            ) as total_device_count,
            (
              select count(*)
              from public.device_realtime
              where status = 'online'
            ) as online_device_count,
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
            ) as today_alarm_count,
            (
              select count(*)
              from public.area
              where enable = true
                and type in ('危险', '限制')
            ) as risk_area_count
        )
        select
          online_person_count,
          case
            when total_device_count = 0 then 0
            else round((online_device_count::numeric / total_device_count::numeric) * 100, 1)
          end as device_online_rate,
          today_alarm_count,
          risk_area_count
        from metrics;
    """

    try:
        connection = await asyncpg.connect(
            database_url,
            ssl=create_ssl_context() if should_use_ssl(database_url) else False,
        )
        row = await connection.fetchrow(query)
    except Exception as exc:
        print(f"Failed to load dashboard metrics: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load dashboard metrics",
        ) from exc
    finally:
        if "connection" in locals():
            await connection.close()

    return {
        "online_person_count": row["online_person_count"],
        "device_online_rate": float(row["device_online_rate"]),
        "today_alarm_count": row["today_alarm_count"],
        "risk_area_count": row["risk_area_count"],
    }
