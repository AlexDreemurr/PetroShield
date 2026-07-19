from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.openapi_docs import API_DESCRIPTION, OPENAPI_TAGS, configure_openapi

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def create_app() -> FastAPI:
    application = FastAPI(
        title="石安盾多源融合安全监管平台 API",
        summary="人员、设备、风险区域与告警闭环的一体化后端接口",
        description=API_DESCRIPTION,
        version="1.0.0",
        openapi_tags=OPENAPI_TAGS,
        servers=[
            {"url": "http://127.0.0.1:8000", "description": "本地开发环境"},
            {"url": "https://petroshield.onrender.com", "description": "线上演示环境"},
        ],
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:5175",
            "http://127.0.0.1:5175",
            "https://petroshield.netlify.app",
            "https://odayaka.me",
            "https://www.odayaka.me",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(
        api_router,
        prefix="/api/v1",
    )
    configure_openapi(application)

    return application


app = create_app()
