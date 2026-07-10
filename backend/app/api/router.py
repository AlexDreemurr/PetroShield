from fastapi import APIRouter

from app.api.routes import dashboard, health

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
