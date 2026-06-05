"""Base repository with shared helpers."""

from __future__ import annotations

from typing import Any, Generic, TypeVar

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepo(Generic[ModelT]):
    """Generic base repository with common CRUD operations."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, model_cls: type[ModelT], pk: str) -> ModelT | None:
        """Fetch a single row by primary key."""
        return await self._session.get(model_cls, pk)

    async def list_all(self, model_cls: type[ModelT]) -> list[ModelT]:
        """Fetch all rows."""
        result = await self._session.execute(select(model_cls))
        return list(result.scalars().all())

    async def add(self, instance: ModelT) -> ModelT:
        """Add a new row and flush."""
        self._session.add(instance)
        await self._session.flush()
        return instance

    async def delete(self, instance: ModelT) -> None:
        """Delete a row and flush."""
        await self._session.delete(instance)
        await self._session.flush()

    async def count(self, model_cls: type[ModelT]) -> int:
        """Return total row count."""
        result = await self._session.execute(
            select(func.count()).select_from(model_cls)
        )
        return result.scalar() or 0
