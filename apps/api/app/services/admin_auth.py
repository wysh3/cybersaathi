"""Admin authentication: JWT, password hashing, seed users, FastAPI dependencies.

Uses PyJWT for token handling and bcrypt for password hashing.
Tokens are delivered via httpOnly cookies for security.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Cookie, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import AdminUserORM
from app.services.database import get_async_session

# --- Configuration ---

JWT_SECRET = os.environ.get("ADMIN_JWT_SECRET", "cybersaathi-admin-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 8  # Shift-length aligned
COOKIE_NAME = "cs_admin_token"
COOKIE_SECURE = os.environ.get("ADMIN_COOKIE_SECURE", "false").lower() in ("1", "true", "yes")
COOKIE_SAMESITE = os.environ.get("ADMIN_COOKIE_SAMESITE", "lax").lower()


# --- Password helpers ---

def hash_password(plain: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a password against a bcrypt hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# --- Seed admin users ---

SEED_USERS = [
    {
        "id": "admin-super-001",
        "officer_id": "admin",
        "password": "admin",
        "role": "super_admin",
        "name": "Super Admin",
    },
    {
        "id": "admin-field-002",
        "officer_id": "officer",
        "password": "officer",
        "role": "field_officer",
        "name": "Field Officer",
    },
]


async def ensure_admin_users(session: AsyncSession) -> None:
    """Seed admin users if they don't exist (idempotent)."""
    for user_data in SEED_USERS:
        result = await session.execute(
            select(AdminUserORM).where(AdminUserORM.officer_id == user_data["officer_id"])
        )
        existing = result.scalar_one_or_none()
        if existing is None:
            admin = AdminUserORM(
                id=user_data["id"],
                officer_id=user_data["officer_id"],
                password_hash=hash_password(user_data["password"]),
                role=user_data["role"],
                name=user_data["name"],
                created_at=datetime.now(tz=timezone.utc),
            )
            session.add(admin)
    await session.commit()


# --- JWT helpers ---

def create_jwt(officer_id: str, role: str, name: str) -> str:
    """Create a JWT token for an admin user."""
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": officer_id,
        "role": role,
        "name": name,
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRY_HOURS),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> dict:
    """Decode and validate a JWT token. Raises on invalid/expired."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def set_auth_cookie(response: Response, token: str) -> None:
    """Set the httpOnly auth cookie on the response."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,  # Use "none" with secure=true for cross-site deployed admin UI.
        max_age=JWT_EXPIRY_HOURS * 3600,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    """Clear the auth cookie."""
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
    )


# --- Auth dependencies ---

class AdminUser:
    """Minimal admin user info extracted from JWT."""
    def __init__(self, officer_id: str, role: str, name: str):
        self.officer_id = officer_id
        self.role = role
        self.name = name


async def get_current_admin(
    request: Request,
    cs_admin_token: Optional[str] = Cookie(None),
) -> AdminUser:
    """FastAPI dependency: extract and validate admin from JWT cookie.

    Raises 401 if no valid token is present.
    """
    if not cs_admin_token:
        raise HTTPException(status_code=401, detail="Not authenticated. Please log in.")

    try:
        payload = decode_jwt(cs_admin_token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session. Please log in again.")

    return AdminUser(
        officer_id=payload["sub"],
        role=payload["role"],
        name=payload["name"],
    )


def require_role(*allowed_roles: str):
    """FastAPI dependency factory: require one of the given roles."""

    async def _check(admin: AdminUser = Depends(get_current_admin)):
        if admin.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Action requires one of these roles: {', '.join(allowed_roles)}",
            )

    return _check


# Shortcut
require_auth = get_current_admin
