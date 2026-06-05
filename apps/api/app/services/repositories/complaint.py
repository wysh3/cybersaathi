"""Complaint repository."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select, and_, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.db import ComplaintORM, ComplaintIdentifierORM
from app.services.repositories.base import BaseRepo


class ComplaintRepo(BaseRepo[ComplaintORM]):
    """CRUD for complaints, including relationship loading."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)
        self._model = ComplaintORM

    async def get(self, pk: str) -> ComplaintORM | None:
        """Fetch a complaint with its identifiers eagerly loaded."""
        stmt = (
            select(ComplaintORM)
            .options(selectinload(ComplaintORM.identifiers))
            .where(ComplaintORM.id == pk)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_session(self, session_id: str) -> list[ComplaintORM]:
        """Fetch all complaints for a given victim session."""
        stmt = (
            select(ComplaintORM)
            .options(selectinload(ComplaintORM.identifiers))
            .where(ComplaintORM.victim_session_id == session_id)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_all(self) -> list[ComplaintORM]:
        """Fetch all complaints with identifiers loaded."""
        stmt = (
            select(ComplaintORM)
            .options(selectinload(ComplaintORM.identifiers))
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_by_state(self, state: str) -> list[ComplaintORM]:
        """Fetch complaints filtered by state."""
        stmt = (
            select(ComplaintORM)
            .where(ComplaintORM.state == state)
            .options(selectinload(ComplaintORM.identifiers))
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_by_fraud_type(self, fraud_type: str) -> list[ComplaintORM]:
        """Fetch complaints filtered by fraud type."""
        stmt = (
            select(ComplaintORM)
            .where(ComplaintORM.fraud_type == fraud_type)
            .options(selectinload(ComplaintORM.identifiers))
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_filtered(
        self,
        *,
        state: Optional[str] = None,
        fraud_type: Optional[str] = None,
        pipeline: Optional[str] = None,
    ) -> list[ComplaintORM]:
        """Fetch complaints with optional filters."""
        conditions = []
        if state:
            conditions.append(ComplaintORM.state == state)
        if fraud_type:
            conditions.append(ComplaintORM.fraud_type == fraud_type)
        if pipeline:
            conditions.append(ComplaintORM.pipeline == pipeline)
        stmt = select(ComplaintORM).options(
            selectinload(ComplaintORM.identifiers)
        )
        if conditions:
            stmt = stmt.where(and_(*conditions))
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_cluster(self, cluster_id: str) -> list[ComplaintORM]:
        """Fetch all complaints belonging to a cluster."""
        stmt = (
            select(ComplaintORM)
            .where(ComplaintORM.cluster_id == cluster_id)
            .options(selectinload(ComplaintORM.identifiers))
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def count_by_state_and_district(
        self,
    ) -> list[tuple[str, str, int]]:
        """Return (state, district, count) tuples for heatmap."""
        stmt = (
            select(
                ComplaintORM.state,
                ComplaintORM.district,
                func.count().label("cnt"),
            )
            .group_by(ComplaintORM.state, ComplaintORM.district)
            .order_by(func.count().desc())
        )
        result = await self._session.execute(stmt)
        return [(row.state, row.district, row.cnt) for row in result]

    async def total_amount_by_state_and_district(
        self,
    ) -> list[tuple[str, str, float]]:
        """Return (state, district, total_amount) for heatmap."""
        stmt = (
            select(
                ComplaintORM.state,
                ComplaintORM.district,
                func.sum(ComplaintORM.amount).label("total"),
            )
            .group_by(ComplaintORM.state, ComplaintORM.district)
        )
        result = await self._session.execute(stmt)
        return [(row.state, row.district, float(row.total)) for row in result]

    async def total_amount(self) -> float:
        """Return sum of all complaint amounts."""
        result = await self._session.execute(
            select(func.coalesce(func.sum(ComplaintORM.amount), 0.0))
        )
        return float(result.scalar())

    async def count(self) -> int:
        result = await self._session.execute(
            select(func.count()).select_from(ComplaintORM)
        )
        return result.scalar() or 0
