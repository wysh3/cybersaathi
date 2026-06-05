"""Cluster repository."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select, and_, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import ClusterORM
from app.services.repositories.base import BaseRepo


class ClusterRepo(BaseRepo[ClusterORM]):
    """CRUD for clusters."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)
        self._model = ClusterORM

    async def get(self, pk: str) -> ClusterORM | None:
        return await self._session.get(ClusterORM, pk)

    async def list_all(self) -> list[ClusterORM]:
        stmt = select(ClusterORM).order_by(ClusterORM.report_count.desc())
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_by_fraud_type(self, fraud_type: str) -> list[ClusterORM]:
        stmt = (
            select(ClusterORM)
            .where(ClusterORM.fraud_type == fraud_type)
            .order_by(ClusterORM.report_count.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_accountability_alerts(self) -> list[ClusterORM]:
        """Return clusters that have crossed the accountability threshold."""
        stmt = (
            select(ClusterORM)
            .where(
                ClusterORM.report_count >= 50,
                ClusterORM.trigger_reason.isnot(None),
            )
            .order_by(ClusterORM.report_count.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_triggered(self) -> list[ClusterORM]:
        """Return clusters that have a trigger_reason set."""
        stmt = (
            select(ClusterORM)
            .where(ClusterORM.trigger_reason.isnot(None))
            .order_by(ClusterORM.report_count.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def update_trigger_reason(
        self, cluster_id: str, reason: str
    ) -> ClusterORM | None:
        stmt = (
            update(ClusterORM)
            .where(ClusterORM.id == cluster_id)
            .values(trigger_reason=reason)
        )
        await self._session.execute(stmt)
        await self._session.flush()
        return await self.get(cluster_id)
