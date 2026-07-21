from __future__ import annotations

import json
import logging
import os
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile

from app.api.routes.risk_control import connect_database, decode_json
from app.security import require_permission
from app.services.qwen_video_analyzer import analyze_safety_media


router = APIRouter()
logger = logging.getLogger(__name__)
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_VIDEO_BYTES = 20 * 1024 * 1024
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm"}


def event_item(row) -> dict:
    return {
        "id": row["id"],
        "event_type": row["event_type"],
        "category": row["category"],
        "risk_level": row["risk_level"],
        "status": row["status"],
        "confidence": float(row["confidence"]),
        "summary": row["summary"],
        "detected_at": row["detected_at"].isoformat(),
        "objects": decode_json(row["objects"], []),
        "evidence": decode_json(row["evidence"], {}),
        "fusion_data": decode_json(row["fusion_data"], {}),
        "linked_alarm_id": row["linked_alarm_id"],
        "camera": {"id": row["camera_id"], "name": row["camera_name"] or "未绑定摄像头"},
        "area": {"id": row["area_id"], "name": row["area_name"] or "未绑定区域"},
    }


EVENT_QUERY = """
select event.*, camera.name as camera_name, camera.area_id,
       area.name as area_name
from public.video_ai_event event
left join public.video_camera_channel camera on camera.id = event.camera_id
left join public.area area on area.id = camera.area_id
"""


async def mark_job_failed(job_id: str, error: Exception) -> None:
    try:
        connection = await connect_database()
        try:
            await connection.execute(
                """update public.video_ai_inference_job
                   set status='failed', error_message=$2, completed_at=now()
                   where id=$1""",
                job_id,
                f"{type(error).__name__}: {error}"[:1000],
            )
        finally:
            await connection.close()
    except Exception:
        # The original task error remains visible in application logs even if the
        # database is temporarily unavailable while recording the failure.
        return


async def run_analysis_job(
    *, job_id: str, camera_id: str | None, content: bytes, mime_type: str,
    media_type: Literal["image", "video"], filename: str | None, context: dict,
) -> None:
    try:
        result = await analyze_safety_media(
            content=content, mime_type=mime_type, media_type=media_type, context=context,
        )
        payload = result.payload
        connection = await connect_database()
        try:
            async with connection.transaction():
                await connection.execute(
                    """update public.video_ai_inference_job
                       set model=$2, status='completed', response_payload=$3::jsonb,
                           latency_ms=$4, completed_at=now(),
                           request_metadata=request_metadata || $5::jsonb
                       where id=$1""",
                    job_id, result.model, json.dumps(payload.model_dump()), result.latency_ms,
                    json.dumps({
                        "provider_request_id": result.request_id,
                        "usage": result.usage,
                        "prompt_version": result.prompt_version,
                    }),
                )
                if payload.abnormal:
                    await connection.execute(
                        """insert into public.video_ai_event
                           (camera_id, inference_job_id, event_type, category, risk_level,
                            confidence, summary, objects, evidence, fusion_data)
                           values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb)""",
                        camera_id, job_id, payload.event_type, payload.category, payload.risk_level,
                        payload.confidence, payload.summary,
                        json.dumps([item.model_dump() for item in payload.objects]),
                        json.dumps({
                            "media_name": filename, "mime_type": mime_type,
                            "notes": payload.evidence_notes,
                            "suggested_actions": payload.suggested_actions,
                            "provider": result.provider, "model": result.model,
                        }),
                        json.dumps({
                            "visual_confidence": payload.confidence,
                            "fusion_confidence": payload.confidence,
                        }),
                    )
        finally:
            await connection.close()
    except Exception as exc:
        logger.exception("Video AI analysis job %s failed", job_id)
        await mark_job_failed(job_id, exc)


@router.get("/overview")
async def get_video_ai_overview():
    connection = await connect_database()
    try:
        cameras = await connection.fetch(
            """
            select camera.*, area.name as area_name, device.type as device_type
            from public.video_camera_channel camera
            left join public.area area on area.id = camera.area_id
            left join public.device device on device.id = camera.device_id
            order by camera.sort_order, camera.name
            """
        )
        events = await connection.fetch(EVENT_QUERY + " order by event.detected_at desc limit 60")
        predictions = await connection.fetch(
            """
            select prediction.*, device.name as device_name, device.region_id, area.name as area_name
            from public.sensor_anomaly_prediction prediction
            join public.device device on device.id = prediction.device_id
            left join public.area area on area.id = device.region_id
            order by prediction.observed_at desc limit 30
            """
        )
        category_rows = await connection.fetch(
            """
            select category, event_type, count(*)::integer as count
            from public.video_ai_event
            where detected_at >= now() - interval '24 hours'
            group by category, event_type order by count(*) desc, event_type limit 20
            """
        )
    finally:
        await connection.close()

    latest_event = event_item(events[0]) if events else None
    return {
        "provider": {
            "name": "dashscope",
            "model": os.getenv("VIDEO_AI_VISION_MODEL", "qwen3-vl-flash"),
            "configured": bool(os.getenv("DASHSCOPE_API_KEY", "").strip()),
        },
        "cameras": [
            {
                "id": row["id"], "device_id": row["device_id"], "name": row["name"],
                "group_name": row["group_name"], "area_id": row["area_id"],
                "area_name": row["area_name"] or "未绑定区域", "status": row["status"],
                "preview_url": row["preview_url"], "stream_url": row["stream_url"],
                "device_type": row["device_type"], "metadata": decode_json(row["metadata"], {}),
            }
            for row in cameras
        ],
        "events": [event_item(row) for row in events],
        "statistics": [dict(row) for row in category_rows],
        "predictions": [
            {
                "id": row["id"], "device_id": row["device_id"], "device_name": row["device_name"],
                "area_name": row["area_name"] or "未绑定区域", "metric": row["metric"],
                "observed_value": row["observed_value"], "expected_value": row["expected_value"],
                "predicted_value": row["predicted_value"], "anomaly_score": row["anomaly_score"],
                "horizon_minutes": row["horizon_minutes"], "risk_level": row["risk_level"],
                "status": row["status"], "observed_at": row["observed_at"].isoformat(),
                "explanation": row["explanation"],
            }
            for row in predictions
        ],
        "fusion": None if not latest_event else {
            "event_id": latest_event["id"], "target_type": latest_event["category"],
            "visual_confidence": latest_event["confidence"],
            "location_confidence": latest_event["fusion_data"].get("location_confidence"),
            "fusion_confidence": latest_event["fusion_data"].get("fusion_confidence", latest_event["confidence"]),
            "area": latest_event["area"], "camera": latest_event["camera"],
            "detected_at": latest_event["detected_at"],
        },
    }


@router.post("/analyze", status_code=202, dependencies=[Depends(require_permission("video.analyze"))])
async def analyze_media(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    camera_id: str | None = Form(default=None),
):
    mime_type = (file.content_type or "").lower()
    if mime_type in IMAGE_TYPES:
        media_type: Literal["image", "video"] = "image"
        limit = MAX_IMAGE_BYTES
    elif mime_type in VIDEO_TYPES:
        media_type = "video"
        limit = MAX_VIDEO_BYTES
    else:
        raise HTTPException(status_code=422, detail="仅支持 JPG、PNG、WebP、MP4、MOV 或 WebM")
    content = await file.read(limit + 1)
    if len(content) > limit:
        raise HTTPException(status_code=413, detail=f"{media_type}文件过大")

    connection = await connect_database()
    try:
        camera = None
        if camera_id:
            camera = await connection.fetchrow(
                """select camera.id, camera.name, camera.area_id, area.name as area_name
                   from public.video_camera_channel camera left join public.area area on area.id=camera.area_id
                   where camera.id=$1""",
                camera_id,
            )
            if not camera:
                raise HTTPException(status_code=404, detail="摄像头通道不存在")
        job_id = await connection.fetchval(
            """insert into public.video_ai_inference_job
               (camera_id, media_type, media_name, provider, status, request_metadata)
               values ($1,$2,$3,'dashscope','processing',$4::jsonb) returning id""",
            camera_id, media_type, file.filename, json.dumps({"mime_type": mime_type, "size": len(content)}),
        )
    finally:
        await connection.close()

    context = {
        "camera": None if not camera else {"id": camera["id"], "name": camera["name"]},
        "area": None if not camera else {"id": camera["area_id"], "name": camera["area_name"]},
        "media_name": file.filename,
    }
    background_tasks.add_task(
        run_analysis_job,
        job_id=job_id, camera_id=camera_id, content=content, mime_type=mime_type,
        media_type=media_type, filename=file.filename, context=context,
    )
    return {"job_id": job_id, "status": "processing"}


@router.get("/jobs/{job_id}")
async def get_analysis_job(job_id: str):
    connection = await connect_database()
    try:
        row = await connection.fetchrow(
            """select job.*, event.id as event_id
               from public.video_ai_inference_job job
               left join public.video_ai_event event on event.inference_job_id=job.id
               where job.id=$1""",
            job_id,
        )
    finally:
        await connection.close()
    if not row:
        raise HTTPException(status_code=404, detail="视频AI识别任务不存在")
    return {
        "job_id": row["id"], "status": row["status"], "event_id": row["event_id"],
        "result": decode_json(row["response_payload"], None), "model": row["model"],
        "latency_ms": row["latency_ms"], "error": row["error_message"],
        "created_at": row["created_at"].isoformat(),
        "completed_at": row["completed_at"].isoformat() if row["completed_at"] else None,
    }


@router.post("/events/{event_id}/promote", dependencies=[Depends(require_permission("video.promote"))])
async def promote_event_to_alarm(event_id: str):
    connection = await connect_database()
    try:
        async with connection.transaction():
            row = await connection.fetchrow(
                EVENT_QUERY + " where event.id=$1 for update of event",
                event_id,
            )
            if not row:
                raise HTTPException(status_code=404, detail="视频AI事件不存在")
            if row["linked_alarm_id"]:
                return {"alarm_id": row["linked_alarm_id"], "created": False}
            area = await connection.fetchrow("select center, polygon from public.area where id=$1", row["area_id"]) if row["area_id"] else None
            center = decode_json(area["center"], None) if area else None
            if not center and area:
                polygon = decode_json(area["polygon"], [])
                if polygon:
                    center = {"x": sum(point["x"] for point in polygon) / len(polygon), "y": sum(point["y"] for point in polygon) / len(polygon)}
            location = {"area_id": row["area_id"], "area_name": row["area_name"], **(center or {"x": 300, "y": 220})}
            evidence = decode_json(row["evidence"], {})
            evidence.update({"video_ai_event_id": row["id"], "camera_id": row["camera_id"], "camera_name": row["camera_name"], "objects": decode_json(row["objects"], [])})
            alarm_id = await connection.fetchval(
                """insert into public.alarm
                   (type, level, location, time, status, confidence, description, evidence)
                   values ($1,$2,$3::jsonb,$4,'新建',$5,$6,$7::jsonb) returning id""",
                row["event_type"], row["risk_level"], json.dumps(location), row["detected_at"],
                row["confidence"], row["summary"], json.dumps(evidence),
            )
            await connection.execute("update public.video_ai_event set status='promoted', linked_alarm_id=$2 where id=$1", event_id, alarm_id)
        return {"alarm_id": alarm_id, "created": True}
    finally:
        await connection.close()
