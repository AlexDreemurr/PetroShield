from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def create_app() -> FastAPI:
    application = FastAPI(
        title="PetroShield API",
        description="石安盾智能安全监管系统后端 API",
        version="0.1.0",
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
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(
        api_router,
        prefix="/api/v1",
    )

    return application


app = create_app()
