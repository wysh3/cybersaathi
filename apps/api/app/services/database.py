"""PostgreSQL database engine, session factory, and FastAPI dependency.

Supports both async (via asyncpg) and sync (via psycopg) SQLAlchemy engines.
The sync engine is used by ``DatabaseStore`` since all existing routers are
synchronous. The async engine is available for future async routers and the
lifespan / health-check hooks.
"""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from typing import Optional

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import Session, sessionmaker

from app.models.db import Base

# Default: local Postgres. Override with env var.
# Format: postgresql+asyncpg://user:pass@host:port/dbname
DEFAULT_DATABASE_URL = "postgresql+asyncpg://cybersaathi:cybersaathi@127.0.0.1:5432/cybersaathi"
DEFAULT_SYNC_DATABASE_URL = "postgresql+psycopg://cybersaathi:cybersaathi@127.0.0.1:5432/cybersaathi"


def _db_url() -> str:
    return os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)


def _sync_db_url() -> str:
    """Derive sync URL from the async URL by replacing the driver."""
    url = _db_url()
    return url.replace("+asyncpg", "+psycopg").replace("postgresql://", "postgresql+psycopg://")


# --- Async engine (for lifespan, health checks, future async routers) ---

_async_engine = None
_async_sessionmaker: Optional[async_sessionmaker[AsyncSession]] = None


def get_async_engine():
    """Return the singleton async engine, creating it on first call."""
    global _async_engine
    if _async_engine is None:
        _async_engine = create_async_engine(
            _db_url(),
            echo=os.environ.get("DATABASE_ECHO", "false").lower() in ("1", "true", "yes"),
            pool_size=int(os.environ.get("DATABASE_POOL_SIZE", "5")),
            max_overflow=int(os.environ.get("DATABASE_MAX_OVERFLOW", "10")),
        )
    return _async_engine


def get_async_sessionmaker() -> async_sessionmaker[AsyncSession]:
    """Return the singleton async session factory."""
    global _async_sessionmaker
    if _async_sessionmaker is None:
        _async_sessionmaker = async_sessionmaker(
            bind=get_async_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _async_sessionmaker


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async DB session."""
    sm = get_async_sessionmaker()
    async with sm() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """Create all tables using the async engine."""
    engine = get_async_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def dispose_async_engine() -> None:
    """Clean up async resources."""
    global _async_engine, _async_sessionmaker
    if _async_engine is not None:
        await _async_engine.dispose()
        _async_engine = None
        _async_sessionmaker = None


async def check_db_health() -> dict[str, str]:
    """Return a health-check dict using the async engine."""
    import sqlalchemy as sa

    try:
        sm = get_async_sessionmaker()
        async with sm() as session:
            await session.execute(sa.text("SELECT 1"))
        return {"database": "connected"}
    except Exception as exc:
        return {"database": f"error: {exc}"}


# --- Sync engine (for DatabaseStore — all existing routers are sync) ---

_sync_engine = None
_sync_sessionmaker: Optional[sessionmaker[Session]] = None


def get_sync_engine():
    """Return the singleton sync engine, creating it on first call."""
    global _sync_engine
    if _sync_engine is None:
        _sync_engine = create_engine(
            _sync_db_url(),
            echo=os.environ.get("DATABASE_ECHO", "false").lower() in ("1", "true", "yes"),
            pool_size=int(os.environ.get("DATABASE_POOL_SIZE", "5")),
            max_overflow=int(os.environ.get("DATABASE_MAX_OVERFLOW", "10")),
        )
    return _sync_engine


def get_sync_sessionmaker() -> sessionmaker[Session]:
    """Return the singleton sync session factory."""
    global _sync_sessionmaker
    if _sync_sessionmaker is None:
        _sync_sessionmaker = sessionmaker(
            bind=get_sync_engine(),
            expire_on_commit=False,
        )
    return _sync_sessionmaker


def get_sync_session() -> Session:
    """Return a new sync session. Caller must close it or use as context manager."""
    return get_sync_sessionmaker()()


def dispose_sync_engine() -> None:
    """Clean up sync resources."""
    global _sync_engine, _sync_sessionmaker
    if _sync_engine is not None:
        _sync_engine.dispose()
        _sync_engine = None
        _sync_sessionmaker = None


# --- Convenience ---
# Keep old names for backward compatibility
get_engine = get_async_engine
get_sessionmaker = get_async_sessionmaker


__all__ = [
    "get_async_engine",
    "get_async_sessionmaker",
    "get_async_session",
    "get_sync_engine",
    "get_sync_sessionmaker",
    "get_sync_session",
    "init_db",
    "dispose_async_engine",
    "dispose_sync_engine",
    "check_db_health",
    "Base",
]
