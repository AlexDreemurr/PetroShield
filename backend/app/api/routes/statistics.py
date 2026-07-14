import asyncpg
from fastapi import APIRouter, HTTPException, status

from app.api.routes.dashboard import (
    create_ssl_context,
    get_database_url,
    should_use_ssl,
)

router = APIRouter()


def ratio(count: int, total: int) -> float:
    return round(count / total * 100, 1) if total else 0


@router.get("/overview")
async def get_statistics_overview():
    database_url = get_database_url()

    if not database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL or SUPABASE_DB_URL is not configured",
        )

    metrics_query = """
        select
          (select count(*) from public.alarm) as alarm_count,
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
            date_trunc('day', now() at time zone 'Asia/Shanghai') - interval '6 days',
            date_trunc('day', now() at time zone 'Asia/Shanghai'),
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
            date_trunc('day', now() at time zone 'Asia/Shanghai') - interval '6 days',
            date_trunc('day', now() at time zone 'Asia/Shanghai'),
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

    alarm_type_query = """
        select type as label, count(*) as count
        from public.alarm
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

    area_heat_query = """
        select
          coalesce(area.name, alarm.location ->> 'area_id', '未知区域') as label,
          count(alarm.id) as count
        from public.alarm alarm
        left join public.area area on area.id = alarm.location ->> 'area_id'
        group by 1
        order by count(alarm.id) desc
        limit 6;
    """

    top_device_query = """
        select
          d.name,
          d.type,
          coalesce(dc.risk_level, '中风险') as risk_level,
          count(a.id) as alarm_count,
          coalesce(area.name, '未分区') as area_name
        from public.device d
        left join public.alarm a on a.device_id = d.id
        left join public.area area on area.id = d.region_id
        left join public.device_compliance dc on dc.device_id = d.id
        group by d.id, d.name, d.type, dc.risk_level, area.name
        order by count(a.id) desc, d.name
        limit 5;
    """

    top_area_query = """
        select
          coalesce(area.name, a.location ->> 'area_id', '未知区域') as name,
          count(a.id) as alarm_count
        from public.alarm a
        left join public.area area on area.id = a.location ->> 'area_id'
        group by 1
        order by count(a.id) desc
        limit 5;
    """

    top_person_query = """
        select
          p.name,
          coalesce(p.department, p.company, '未分组') as department,
          count(a.id) as alarm_count
        from public.person p
        left join public.alarm a on a.person_id = p.id
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
        metrics = await connection.fetchrow(metrics_query)
        alarm_trend = await connection.fetch(trend_query)
        person_distribution = await connection.fetch(person_distribution_query)
        device_online_trend = await connection.fetch(device_online_trend_query)
        alarm_types = await connection.fetch(alarm_type_query)
        risk_levels = await connection.fetch(risk_level_query)
        area_heat = await connection.fetch(area_heat_query)
        top_devices = await connection.fetch(top_device_query)
        top_areas = await connection.fetch(top_area_query)
        top_people = await connection.fetch(top_person_query)
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

    alarm_total = metrics["alarm_count"]
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
