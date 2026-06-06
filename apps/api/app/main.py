"""FastAPI entry point for CyberSaathi.

Run with the official ``fastapi`` CLI:
    uv run fastapi dev
or:
    uv run fastapi run
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    clusters_router,
    complaints_router,
    dashboards_router,
    evidence_router,
    fall_back_router,
    intake_router,
    intake_chat_router,
    integrations_router,
    map_router,
    similarity_router,
    post_report_router,
    admin_router,
    tts_router,
)
from app.seed import write_seed_files


DEFAULT_SEED_DIR = (
    # apps/api/app/main.py -> apps/api/app -> apps/api -> apps -> <monorepo root>
    Path(__file__).resolve().parents[3] / "seed_data"
)


def _cors_origins() -> list[str]:
    configured = os.environ.get("CORS_ORIGINS")
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialise DB on startup, dispose on shutdown."""
    from app.services.db_store import is_database_enabled

    if is_database_enabled():
        from app.services.database import init_db, dispose_async_engine

        await init_db()
    yield
    if is_database_enabled():
        from app.services.database import dispose_async_engine

        await dispose_async_engine()


def create_app() -> FastAPI:
    app = FastAPI(
        title="CyberSaathi API",
        version="0.1.0",
        description=(
            "Victim-state engine for cybercrime emergencies. All official "
            "integrations are simulated. Source of truth: AGENTS.md."
        ),
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    try:
        write_seed_files(DEFAULT_SEED_DIR)
    except OSError:
        # File may be locked by another process; seed data is already on disk
        pass
    app.include_router(intake_router)
    app.include_router(intake_chat_router)
    app.include_router(evidence_router)
    app.include_router(complaints_router)
    app.include_router(similarity_router)
    app.include_router(clusters_router)
    app.include_router(dashboards_router)
    app.include_router(fall_back_router)
    app.include_router(integrations_router)
    app.include_router(map_router)
    app.include_router(post_report_router)
    app.include_router(admin_router)
    app.include_router(tts_router)

    @app.get("/healthz", tags=["meta"])
    async def healthz() -> dict[str, str]:
        from app.services.db_store import is_database_enabled

        result: dict[str, str] = {"status": "ok"}
        if is_database_enabled():
            from app.services.database import check_db_health

            result["database"] = (await check_db_health()).get("database", "unknown")
        return result

    @app.get("/", tags=["meta"])
    def root() -> dict[str, str]:
        return {
            "service": "CyberSaathi API",
            "docs": "/docs",
            "health": "/healthz",
        }

    return app


app = create_app()
