"""Mock integration event repository."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import MockIntegrationEventORM
from app.services.repositories.base import BaseRepo


class IntegrationEventRepo(BaseRepo[MockIntegrationEventORM]):
    """CRUD for mock integration events."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)
        self._model = MockIntegrationEventORM

    async def get(self, pk: str) -> MockIntegrationEventORM | None:
        return await self._session.get(MockIntegrationEventORM, pk)

    async def list_recent(self, limit: int = 25) -> list[MockIntegrationEventORM]:
        """Return the most recent events."""
        stmt = (
            select(MockIntegrationEventORM)
            .order_by(MockIntegrationEventORM.created_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_all(self) -> list[MockIntegrationEventORM]:
        result = await self._session.execute(
            select(MockIntegrationEventORM).order_by(
                MockIntegrationEventORM.created_at.desc()
            )
        )
        return list(result.scalars().all())

    async def list_by_adapter(self, adapter: str) -> list[MockIntegrationEventORM]:
        stmt = (
            select(MockIntegrationEventORM)
            .where(MockIntegrationEventORM.adapter == adapter)
            .order_by(MockIntegrationEventORM.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
