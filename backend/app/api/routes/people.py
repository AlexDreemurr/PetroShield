import asyncpg
from fastapi import APIRouter, HTTPException, status

from app.api.routes.dashboard import (
    create_ssl_context,
    get_database_url,
    should_use_ssl,
)

router = APIRouter()


@router.get("/locations")
async def get_people_locations():
    database_url = get_database_url()

    if not database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL or SUPABASE_DB_URL is not configured",
        )

    people_query = """
        select
          p.id,
          p.name,
          p.gender,
          p.type,
          p.department,
          p.position,
          p.company,
          p.id_card,
          p.phone,
          p.device_id,
          p.device_type,
          p.bind_time,
          p.location_zone,
          p.status,
          p.risk_level,
          p.access_status,
          p.last_active_time,
          p.safety_tag,
          p.training_status,
          p.training_score,
          p.last_training_time,
          p.certificate_status,
          p.health_status,
          p.health_risk_level,
          p.last_medical_check,
          p.occupational_disease_flag,
          p.exposure_level,
          p.performance_score,
          p.violation_count,
          p.reward_count,
          p.near_miss_count,
          p.safety_score,
          p.remark,
          latest_position.x,
          latest_position.y,
          latest_position.z,
          latest_position.source as location_source,
          latest_position.confidence as location_confidence,
          latest_position."timestamp" as location_time,
          latest_position.speed,
          latest_position.direction
        from public.person p
        left join lateral (
          select x, y, z, source, confidence, "timestamp", speed, direction
          from public.position
          where person_id = p.id
          order by "timestamp" desc, create_time desc, id desc
          limit 1
        ) latest_position on true
        order by p.id;
    """

    track_query = """
        select person_id, x, y, z, source, confidence, "timestamp", speed, direction
        from (
          select
            pos.*,
            row_number() over (
              partition by person_id
              order by "timestamp" desc, create_time desc, id desc
            ) as row_number
          from public.position pos
          where person_id = any($1::text[])
        ) ranked_position
        where row_number <= 12
        order by person_id, "timestamp";
    """

    try:
        connection = await asyncpg.connect(
            database_url,
            ssl=create_ssl_context() if should_use_ssl(database_url) else False,
        )
        people_rows = await connection.fetch(people_query)
        person_ids = [row["id"] for row in people_rows]
        track_rows = (
            await connection.fetch(track_query, person_ids) if person_ids else []
        )
    except Exception as exc:
        print(f"Failed to load people locations: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load people locations",
        ) from exc
    finally:
        if "connection" in locals():
            await connection.close()

    tracks_by_person: dict[str, list[dict]] = {}
    for row in track_rows:
        tracks_by_person.setdefault(row["person_id"], []).append(
            {
                "x": row["x"],
                "y": row["y"],
                "z": row["z"],
                "source": row["source"],
                "confidence": float(row["confidence"]),
                "timestamp": row["timestamp"].isoformat(),
                "speed": row["speed"],
                "direction": row["direction"],
            }
        )

    return {
        "items": [
            {
                "id": row["id"],
                "name": row["name"],
                "gender": row["gender"],
                "type": row["type"],
                "department": row["department"],
                "position": row["position"],
                "company": row["company"],
                "id_card": row["id_card"],
                "phone": row["phone"],
                "device_id": row["device_id"],
                "device_type": row["device_type"],
                "bind_time": row["bind_time"].isoformat()
                if row["bind_time"]
                else None,
                "location_zone": row["location_zone"],
                "status": row["status"],
                "risk_level": row["risk_level"],
                "access_status": row["access_status"],
                "last_active_time": row["last_active_time"].isoformat()
                if row["last_active_time"]
                else None,
                "safety_tag": row["safety_tag"],
                "training_status": row["training_status"],
                "training_score": row["training_score"],
                "last_training_time": row["last_training_time"].isoformat()
                if row["last_training_time"]
                else None,
                "certificate_status": row["certificate_status"],
                "health_status": row["health_status"],
                "health_risk_level": row["health_risk_level"],
                "last_medical_check": row["last_medical_check"].isoformat()
                if row["last_medical_check"]
                else None,
                "occupational_disease_flag": row["occupational_disease_flag"],
                "exposure_level": row["exposure_level"],
                "performance_score": row["performance_score"],
                "violation_count": row["violation_count"],
                "reward_count": row["reward_count"],
                "near_miss_count": row["near_miss_count"],
                "safety_score": row["safety_score"],
                "remark": row["remark"],
                "latest_position": {
                    "x": row["x"],
                    "y": row["y"],
                    "z": row["z"],
                    "source": row["location_source"],
                    "confidence": float(row["location_confidence"])
                    if row["location_confidence"] is not None
                    else None,
                    "timestamp": row["location_time"].isoformat()
                    if row["location_time"]
                    else None,
                    "speed": row["speed"],
                    "direction": row["direction"],
                }
                if row["x"] is not None
                else None,
                "track": tracks_by_person.get(row["id"], []),
            }
            for row in people_rows
        ]
    }
