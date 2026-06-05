"""Scam identifier repository."""

from __future__ import annotations

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.db import ScamIdentifierORM, ComplaintIdentifierORM
from app.services.repositories.base import BaseRepo


class IdentifierRepo(BaseRepo[ScamIdentifierORM]):
    """CRUD for scam identifiers."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)
        self._model = ScamIdentifierORM

    async def get(self, pk: str) -> ScamIdentifierORM | None:
        stmt = (
            select(ScamIdentifierORM)
            .options(selectinload(ScamIdentifierORM.complaints))
            .where(ScamIdentifierORM.id == pk)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def find_by_normalized(
        self,
        type_: str,
        normalized_value: str,
    ) -> list[ScamIdentifierORM]:
        """Find identifiers by type and normalized value (exact match)."""
        stmt = (
            select(ScamIdentifierORM)
            .options(selectinload(ScamIdentifierORM.complaints))
            .where(
                ScamIdentifierORM.type == type_,
                ScamIdentifierORM.normalized_value == normalized_value,
            )
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def find_by_type_value_endswith(
        self,
        type_: str,
        suffix: str,
    ) -> list[ScamIdentifierORM]:
        """Find identifiers by type where normalized_value ends with suffix."""
        stmt = (
            select(ScamIdentifierORM)
            .options(selectinload(ScamIdentifierORM.complaints))
            .where(
                ScamIdentifierORM.type == type_,
                ScamIdentifierORM.normalized_value.like(f"%{suffix}"),
            )
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def find_by_types_and_value(
        self,
        types: list[str],
        normalized_value: str,
    ) -> list[ScamIdentifierORM]:
        """Find identifiers by multiple possible types and exact normalized value."""
        stmt = (
            select(ScamIdentifierORM)
            .options(selectinload(ScamIdentifierORM.complaints))
            .where(
                ScamIdentifierORM.type.in_(types),
                ScamIdentifierORM.normalized_value == normalized_value,
            )
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def find_by_type_and_value_contains(
        self,
        type_: str,
        value_substring: str,
    ) -> list[ScamIdentifierORM]:
        """Find identifiers by type where normalized_value contains substring."""
        stmt = (
            select(ScamIdentifierORM)
            .options(selectinload(ScamIdentifierORM.complaints))
            .where(
                ScamIdentifierORM.type == type_,
                ScamIdentifierORM.normalized_value.like(f"%{value_substring}%"),
            )
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_all(self) -> list[ScamIdentifierORM]:
        stmt = select(ScamIdentifierORM).options(
            selectinload(ScamIdentifierORM.complaints)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
