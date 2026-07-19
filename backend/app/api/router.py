from fastapi import APIRouter, Depends

from app.api.routes import (
    alarm_center,
    auth,
    dashboard,
    devices,
    health,
    people,
    risk_control,
    statistics,
    system_management,
)
from app.security import require_permission

api_router = APIRouter()

api_router.include_router(
    health.router,
    prefix="/health",
    tags=["系统状态"],
)

api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["登录认证"],
)

api_router.include_router(
    dashboard.router,
    prefix="/dashboard",
    tags=["首页"],
    dependencies=[Depends(require_permission("dashboard.view"))],
)

api_router.include_router(
    people.router,
    prefix="/people",
    tags=["人员管理"],
    dependencies=[Depends(require_permission("people.view"))],
)

api_router.include_router(
    devices.router,
    prefix="/devices",
    tags=["设备管理"],
    dependencies=[Depends(require_permission("devices.view"))],
)

api_router.include_router(
    risk_control.router,
    prefix="/risk-control",
    tags=["风险管控"],
    dependencies=[Depends(require_permission("risk.view"))],
)

api_router.include_router(
    alarm_center.router,
    prefix="/alarms",
    tags=["告警中心"],
    dependencies=[Depends(require_permission("alarms.view"))],
)

api_router.include_router(
    statistics.router,
    prefix="/statistics",
    tags=["统计分析"],
    dependencies=[Depends(require_permission("statistics.view"))],
)

api_router.include_router(
    system_management.router,
    prefix="/system",
    tags=["系统管理"],
)
