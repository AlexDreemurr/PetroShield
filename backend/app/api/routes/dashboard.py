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


def build_distribution(total: int, items: list[tuple[str, str, int]]) -> dict:
    return {
        key: {
            "label": label,
            "count": count,
            "ratio": round((count / total) * 100, 1) if total else 0,
        }
        for key, label, count in items
    }


@router.get("/metrics")
async def get_dashboard_metrics():
    database_url = get_database_url()

    if not database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL or SUPABASE_DB_URL is not configured",
        )

    query = """
        with person_bucket as (
          select
            case
              when status = '离线' then 'offline'
              when status = '禁止进入' or risk_level in ('高', '极高') then 'high_risk'
              when status in ('异常', '风险') or risk_level = '中' then 'medium_risk'
              else 'normal'
            end as bucket
          from public.person
        ),
        person_counts as (
          select
            count(*) as total,
            count(*) filter (where bucket = 'normal') as normal_count,
            count(*) filter (where bucket = 'high_risk') as high_risk_count,
            count(*) filter (where bucket = 'medium_risk') as medium_risk_count,
            count(*) filter (where bucket = 'offline') as offline_count
          from person_bucket
        ),
        device_bucket as (
          select
            case
              when coalesce(dr.status, 'offline') = 'online' then 'online'
              when coalesce(dr.status, 'offline') = 'offline' then 'offline'
              else 'alarm'
            end as bucket
          from public.device d
          left join public.device_realtime dr on dr.device_id = d.id
        ),
        device_counts as (
          select
            count(*) as total,
            count(*) filter (where bucket = 'online') as online_count,
            count(*) filter (where bucket = 'offline') as offline_count,
            count(*) filter (where bucket = 'alarm') as alarm_count
          from device_bucket
        ),
        metrics as (
          select
            (
              select count(*)
              from public.person
              where status <> '离线'
            ) as online_person_count,
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
          m.online_person_count,
          case
            when dc.total = 0 then 0
            else round((dc.online_count::numeric / dc.total::numeric) * 100, 1)
          end as device_online_rate,
          m.today_alarm_count,
          m.risk_area_count,
          pc.total as person_total_count,
          pc.normal_count as person_normal_count,
          pc.high_risk_count as person_high_risk_count,
          pc.medium_risk_count as person_medium_risk_count,
          pc.offline_count as person_offline_count,
          dc.total as device_total_count,
          dc.online_count as device_online_count,
          dc.offline_count as device_offline_count,
          dc.alarm_count as device_alarm_count
        from metrics m
        cross join person_counts pc
        cross join device_counts dc;
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

    person_total_count = row["person_total_count"]
    device_total_count = row["device_total_count"]

    return {
        "online_person_count": row["online_person_count"],
        "device_online_rate": float(row["device_online_rate"]),
        "today_alarm_count": row["today_alarm_count"],
        "risk_area_count": row["risk_area_count"],
        "person_status_distribution": build_distribution(
            person_total_count,
            [
                ("normal", "正常", row["person_normal_count"]),
                ("high_risk", "高风险", row["person_high_risk_count"]),
                ("medium_risk", "中风险", row["person_medium_risk_count"]),
                ("offline", "离线", row["person_offline_count"]),
            ],
        ),
        "device_status_distribution": build_distribution(
            device_total_count,
            [
                ("online", "在线", row["device_online_count"]),
                ("offline", "离线", row["device_offline_count"]),
                ("alarm", "告警", row["device_alarm_count"]),
            ],
        ),
    }
