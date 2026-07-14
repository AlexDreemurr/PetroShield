from fastapi import APIRouter

from app.api.routes import dashboard, devices, health, people

api_router = APIRouter()

api_router.include_router(
    health.router,
    prefix="/health",
    tags=["系统状态"],
)

api_router.include_router(
    dashboard.router,
    prefix="/dashboard",
    tags=["首页"],
)

api_router.include_router(
    people.router,
    prefix="/people",
    tags=["人员管理"],
)

api_router.include_router(
    devices.router,
    prefix="/devices",
    tags=["设备管理"],
)
