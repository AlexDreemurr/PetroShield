import json
import os
import ssl
from urllib.parse import urlsplit

import asyncpg
from fastapi import APIRouter, HTTPException, Query, status

router = APIRouter()


def decode_json(value, fallback):
    if value is None:
        return fallback
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return fallback
    return value


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


def build_metric_comparison(
    current_value: int | float,
    previous_value: int | float | None,
    unit: str,
    decimals: int = 0,
) -> dict:
    if previous_value is None:
        return {
            "value": None,
            "label": "昨日无数据",
            "trend": "flat",
        }

    delta = float(current_value or 0) - float(previous_value or 0)
    rounded_delta = round(delta, decimals)
    trend = "up" if delta > 0 else "down" if delta < 0 else "flat"
    sign = "+" if rounded_delta > 0 else ""
    display_value = (
        f"{rounded_delta:.{decimals}f}" if decimals > 0 else str(int(rounded_delta))
    )

    return {
        "value": rounded_delta,
        "label": f"{sign}{display_value}{unit}",
        "trend": trend,
        "previous_value": previous_value,
    }


def build_alarm_title(alarm_type: str | None) -> str:
    if not alarm_type:
        return "未知告警"

    return alarm_type if alarm_type.endswith("告警") else f"{alarm_type}告警"


def build_alarm_meta(row: asyncpg.Record) -> str:
    if row["person_name"]:
        person_parts = [
            row["person_name"],
            row["person_department"] or row["person_company"],
        ]
        return " / ".join(part for part in person_parts if part)

    if row["device_name"]:
        device_parts = [row["device_name"], row["device_type"]]
        return " / ".join(part for part in device_parts if part)

    return row["status"]


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
              from public.alarm
              where "time" >= (
                (date_trunc('day', now() at time zone 'Asia/Shanghai') - interval '1 day')
                at time zone 'Asia/Shanghai'
              )
              and "time" < (
                date_trunc('day', now() at time zone 'Asia/Shanghai')
                at time zone 'Asia/Shanghai'
              )
            ) as yesterday_alarm_count,
            (
              select count(*)
              from public.area
              where enable = true
                and type in ('危险', '限制')
            ) as risk_area_count,
            (
              select count(*)
              from public.area
              where enable = true
                and type in ('危险', '限制')
                and create_time < (
                  date_trunc('day', now() at time zone 'Asia/Shanghai')
                  at time zone 'Asia/Shanghai'
                )
            ) as yesterday_risk_area_count,
            (
              select count(distinct pos.person_id)
              from public.position pos
              where pos."timestamp" >= (
                (date_trunc('day', now() at time zone 'Asia/Shanghai') - interval '1 day')
                at time zone 'Asia/Shanghai'
              )
              and pos."timestamp" < (
                date_trunc('day', now() at time zone 'Asia/Shanghai')
                at time zone 'Asia/Shanghai'
              )
            ) as yesterday_online_person_count
        ),
        yesterday_device_latest as (
          select distinct on (d.id)
            d.id,
            latest.status
          from public.device d
          left join lateral (
            select o.status
            from public.device_realtime_observation o
            where o.device_id = d.id
              and o.observation_time < (
                date_trunc('day', now() at time zone 'Asia/Shanghai')
                at time zone 'Asia/Shanghai'
              )
            order by o.observation_time desc, o.created_at desc, o.id desc
            limit 1
          ) latest on true
          where d.created_at < (
            date_trunc('day', now() at time zone 'Asia/Shanghai')
            at time zone 'Asia/Shanghai'
          )
        ),
        yesterday_device_counts as (
          select
            count(*) as total,
            count(*) filter (where status = 'online') as online_count
          from yesterday_device_latest
        )
        select
          m.online_person_count,
          m.yesterday_online_person_count,
          case
            when dc.total = 0 then 0
            else round((dc.online_count::numeric / dc.total::numeric) * 100, 1)
          end as device_online_rate,
          case
            when ydc.total = 0 then null
            else round((ydc.online_count::numeric / ydc.total::numeric) * 100, 1)
          end as yesterday_device_online_rate,
          m.today_alarm_count,
          m.yesterday_alarm_count,
          m.risk_area_count,
          m.yesterday_risk_area_count,
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
        cross join device_counts dc
        cross join yesterday_device_counts ydc;
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
        "metric_comparisons": {
            "online_person_count": build_metric_comparison(
                row["online_person_count"],
                row["yesterday_online_person_count"],
                "人",
            ),
            "device_online_rate": build_metric_comparison(
                float(row["device_online_rate"]),
                float(row["yesterday_device_online_rate"])
                if row["yesterday_device_online_rate"] is not None
                else None,
                "个百分点",
                1,
            ),
            "today_alarm_count": build_metric_comparison(
                row["today_alarm_count"],
                row["yesterday_alarm_count"],
                "条",
            ),
            "risk_area_count": build_metric_comparison(
                row["risk_area_count"],
                row["yesterday_risk_area_count"],
                "处",
            ),
        },
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


@router.get("/realtime-alarms")
async def get_realtime_alarms(limit: int = Query(default=5, ge=1, le=20)):
    database_url = get_database_url()

    if not database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL or SUPABASE_DB_URL is not configured",
        )

    query = """
        select
          a.id,
          a.type,
          a.level,
          a.status,
          a."time",
          a.description,
          a.location,
          p.name as person_name,
          p.department as person_department,
          p.company as person_company,
          d.name as device_name,
          d.type as device_type
        from public.alarm a
        left join public.person p on p.id = a.person_id
        left join public.device d on d.id = a.device_id
        where a.status not in ('关闭', '误报')
        order by a."time" desc, a.create_time desc
        limit $1;
    """

    try:
        connection = await asyncpg.connect(
            database_url,
            ssl=create_ssl_context() if should_use_ssl(database_url) else False,
        )
        rows = await connection.fetch(query, limit)
    except Exception as exc:
        print(f"Failed to load realtime alarms: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load realtime alarms",
        ) from exc
    finally:
        if "connection" in locals():
            await connection.close()

    return {
        "items": [
            {
                "id": row["id"],
                "type": row["type"],
                "title": build_alarm_title(row["type"]),
                "level": row["level"],
                "status": row["status"],
                "time": row["time"].isoformat(),
                "description": row["description"],
                "location": decode_json(row["location"], {}),
                "meta": build_alarm_meta(row),
                "person_name": row["person_name"],
                "department": row["person_department"],
                "company": row["person_company"],
                "device_name": row["device_name"],
                "device_type": row["device_type"],
            }
            for row in rows
        ]
    }


@router.get("/alarm-trend")
async def get_alarm_trend(
    days: int = Query(default=7, ge=1, le=31),
    granularity: str = Query(default="day", pattern="^(hour|day|week)$"),
):
    database_url = get_database_url()

    if not database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL or SUPABASE_DB_URL is not configured",
        )

    bucket_config = {
        "hour": {
            "truncate": "hour",
            "step": "1 hour",
            "range_end": "date_trunc('hour', now() at time zone 'Asia/Shanghai')",
        },
        "day": {
            "truncate": "day",
            "step": "1 day",
            "range_end": "date_trunc('day', now() at time zone 'Asia/Shanghai')",
        },
        "week": {
            "truncate": "week",
            "step": "1 week",
            "range_end": "date_trunc('week', now() at time zone 'Asia/Shanghai')",
        },
    }[granularity]

    range_start = """
        date_trunc('day', now() at time zone 'Asia/Shanghai')
          - make_interval(days => $1 - 1)
    """
    series_start = (
        f"date_trunc('week', {range_start})"
        if granularity == "week"
        else range_start
    )

    query = f"""
        with date_range as (
          select generate_series(
            {series_start},
            {bucket_config["range_end"]},
            interval '{bucket_config["step"]}'
          ) as bucket_start
        ),
        alarm_counts as (
          select
            date_trunc(
              '{bucket_config["truncate"]}',
              a."time" at time zone 'Asia/Shanghai'
            ) as bucket_start,
            count(*) filter (where a.level = '重大') as major_count,
            count(*) filter (where a.level = '严重') as severe_count,
            count(*) filter (where a.level = '一般') as general_count
          from public.alarm a
          where a."time" >= ({range_start}) at time zone 'Asia/Shanghai'
          and a."time" < (
            date_trunc('day', now() at time zone 'Asia/Shanghai') + interval '1 day'
          ) at time zone 'Asia/Shanghai'
          group by 1
        )
        select
          d.bucket_start,
          coalesce(a.major_count, 0) as major_count,
          coalesce(a.severe_count, 0) as severe_count,
          coalesce(a.general_count, 0) as general_count
        from date_range d
        left join alarm_counts a using (bucket_start)
        order by d.bucket_start;
    """

    try:
        connection = await asyncpg.connect(
            database_url,
            ssl=create_ssl_context() if should_use_ssl(database_url) else False,
        )
        rows = await connection.fetch(query, days)
    except Exception as exc:
        print(f"Failed to load alarm trend: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load alarm trend",
        ) from exc
    finally:
        if "connection" in locals():
            await connection.close()

    return {
        "range": f"last_{days}_days",
        "granularity": granularity,
        "items": [
            {
                "bucket_start": row["bucket_start"].isoformat(),
                "major": row["major_count"],
                "severe": row["severe_count"],
                "general": row["general_count"],
            }
            for row in rows
        ],
    }


@router.get("/person-health-analysis")
async def get_person_health_analysis(
    days: int = Query(default=7, ge=1, le=31),
    granularity: str = Query(default="day", pattern="^(day|week)$"),
):
    database_url = get_database_url()

    if not database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL or SUPABASE_DB_URL is not configured",
        )

    truncate_unit = "week" if granularity == "week" else "day"
    step = "1 week" if granularity == "week" else "1 day"
    range_start = """
        date_trunc('day', now() at time zone 'Asia/Shanghai')
          - make_interval(days => $1 - 1)
    """
    series_start = (
        f"date_trunc('week', {range_start})"
        if granularity == "week"
        else range_start
    )
    series_end = (
        "date_trunc('week', now() at time zone 'Asia/Shanghai')"
        if granularity == "week"
        else "date_trunc('day', now() at time zone 'Asia/Shanghai')"
    )

    query = f"""
        with bucket_range as (
          select generate_series(
            {series_start},
            {series_end},
            interval '{step}'
          ) as bucket_start
        ),
        enabled_zone as (
          select name as location_zone
          from public.area
          where enable = true
        ),
        ranked_observation as (
          select
            h.*,
            date_trunc(
              '{truncate_unit}',
              h.observation_time at time zone 'Asia/Shanghai'
            ) as bucket_start,
            row_number() over (
              partition by
                h.person_id,
                date_trunc(
                  '{truncate_unit}',
                  h.observation_time at time zone 'Asia/Shanghai'
                )
              order by h.observation_time desc, h.create_time desc, h.id desc
            ) as observation_rank
          from public.person_health_observation h
          where h.observation_time >= ({range_start}) at time zone 'Asia/Shanghai'
          and h.observation_time < (
            date_trunc('day', now() at time zone 'Asia/Shanghai') + interval '1 day'
          ) at time zone 'Asia/Shanghai'
        ),
        latest_observation as (
          select *
          from ranked_observation
          where observation_rank = 1
        ),
        health_counts as (
          select
            location_zone,
            bucket_start,
            count(person_id) as observed_people,
            count(person_id) filter (
              where health_risk_level = '中'
            ) as medium_risk_people,
            count(person_id) filter (
              where health_risk_level in ('高', '极高')
            ) as high_risk_people,
            count(person_id) filter (
              where health_status in ('关注', '限制', '禁入', '异常')
                 or health_risk_level in ('中', '高', '极高')
            ) as risk_people
          from latest_observation
          where location_zone is not null
          group by location_zone, bucket_start
        )
        select
          z.location_zone,
          b.bucket_start,
          coalesce(h.observed_people, 0) as observed_people,
          coalesce(h.medium_risk_people, 0) as medium_risk_people,
          coalesce(h.high_risk_people, 0) as high_risk_people,
          coalesce(h.risk_people, 0) as risk_people,
          case
            when coalesce(h.observed_people, 0) = 0 then 0
            else round(
              h.risk_people::numeric / h.observed_people::numeric * 100
            )
          end as risk_ratio
        from enabled_zone z
        cross join bucket_range b
        left join health_counts h
          on h.location_zone = z.location_zone
         and h.bucket_start = b.bucket_start
        order by z.location_zone, b.bucket_start;
    """

    try:
        connection = await asyncpg.connect(
            database_url,
            ssl=create_ssl_context() if should_use_ssl(database_url) else False,
        )
        rows = await connection.fetch(query, days)
    except Exception as exc:
        print(f"Failed to load person health analysis: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load person health analysis",
        ) from exc
    finally:
        if "connection" in locals():
            await connection.close()

    zones = list(dict.fromkeys(row["location_zone"] for row in rows))
    buckets = list(
        dict.fromkeys(row["bucket_start"].isoformat() for row in rows)
    )

    return {
        "range": f"last_{days}_days",
        "granularity": granularity,
        "zones": zones,
        "buckets": buckets,
        "items": [
            {
                "location_zone": row["location_zone"],
                "bucket_start": row["bucket_start"].isoformat(),
                "observed_people": row["observed_people"],
                "medium_risk_people": row["medium_risk_people"],
                "high_risk_people": row["high_risk_people"],
                "risk_people": row["risk_people"],
                "risk_ratio": float(row["risk_ratio"]),
            }
            for row in rows
        ],
    }


@router.get("/device-online-trend")
async def get_device_online_trend(
    days: int = Query(default=7, ge=1, le=31),
    granularity: str = Query(default="day", pattern="^(day|week)$"),
):
    database_url = get_database_url()

    if not database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL or SUPABASE_DB_URL is not configured",
        )

    step = "1 week" if granularity == "week" else "1 day"
    range_start = """
        date_trunc('day', now() at time zone 'Asia/Shanghai')
          - make_interval(days => $1 - 1)
    """
    series_start = (
        f"date_trunc('week', {range_start})"
        if granularity == "week"
        else range_start
    )
    series_end = (
        "date_trunc('week', now() at time zone 'Asia/Shanghai')"
        if granularity == "week"
        else "date_trunc('day', now() at time zone 'Asia/Shanghai')"
    )

    query = f"""
        with bucket_range as (
          select generate_series(
            {series_start},
            {series_end},
            interval '{step}'
          ) as bucket_start
        ),
        device_at_bucket as (
          select
            b.bucket_start,
            d.id as device_id,
            latest.status
          from bucket_range b
          join public.device d
            on d.created_at < (
              least(
                b.bucket_start + interval '{step}',
                now() at time zone 'Asia/Shanghai'
              ) at time zone 'Asia/Shanghai'
            )
          left join lateral (
            select o.status
            from public.device_realtime_observation o
            where o.device_id = d.id
              and o.observation_time <= (
                least(
                  b.bucket_start + interval '{step}',
                  now() at time zone 'Asia/Shanghai'
                ) at time zone 'Asia/Shanghai'
              )
            order by o.observation_time desc, o.created_at desc, o.id desc
            limit 1
          ) latest on true
        )
        select
          bucket_start,
          count(device_id) as total_count,
          count(device_id) filter (where status = 'online') as online_count,
          count(device_id) filter (where status = 'offline') as offline_count,
          count(device_id) filter (where status = 'fault') as fault_count,
          count(device_id) filter (where status = 'maintenance') as maintenance_count,
          count(device_id) filter (where status is null) as unknown_count,
          case
            when count(device_id) = 0 then 0
            else round(
              count(device_id) filter (where status = 'online')::numeric
              / count(device_id)::numeric * 100,
              1
            )
          end as online_rate
        from device_at_bucket
        group by bucket_start
        order by bucket_start;
    """

    try:
        connection = await asyncpg.connect(
            database_url,
            ssl=create_ssl_context() if should_use_ssl(database_url) else False,
        )
        rows = await connection.fetch(query, days)
    except Exception as exc:
        print(f"Failed to load device online trend: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load device online trend",
        ) from exc
    finally:
        if "connection" in locals():
            await connection.close()

    return {
        "range": f"last_{days}_days",
        "granularity": granularity,
        "items": [
            {
                "bucket_start": row["bucket_start"].isoformat(),
                "online_rate": float(row["online_rate"]),
                "total_count": row["total_count"],
                "online_count": row["online_count"],
                "offline_count": row["offline_count"],
                "fault_count": row["fault_count"],
                "maintenance_count": row["maintenance_count"],
                "unknown_count": row["unknown_count"],
            }
            for row in rows
        ],
    }
