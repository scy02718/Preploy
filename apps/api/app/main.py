from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.logging_config import setup_logging
from app.routers import analysis, health

setup_logging()

app = FastAPI(
    title="Interview Assistant API",
    version="0.1.0",
    description="AI-powered interview analysis and feedback service",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(analysis.router, prefix="/api", tags=["analysis"])
