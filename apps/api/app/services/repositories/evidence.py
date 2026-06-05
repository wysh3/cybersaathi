"""Evidence item repository."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import EvidenceItemORM
from app.services.repositories.base import BaseRepo


class EvidenceRepo(BaseRepo[EvidenceItemORM]):
    """CRUD for evidence items."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)
        self._model = EvidenceItemORM

    async def get(self, pk: str) -> EvidenceItemORM | None:
        return await self._session.get(EvidenceItemORM, pk)

    async def list_for_complaint(self, complaint_id: str) -> list[EvidenceItemORM]:
        """Return all evidence items linked to a complaint."""
        stmt = (
            select(EvidenceItemORM)
            .where(EvidenceItemORM.complaint_id == complaint_id)
            .order_by(EvidenceItemORM.created_at)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_all(self) -> list[EvidenceItemORM]:
        result = await self._session.execute(
            select(EvidenceItemORM).order_by(EvidenceItemORM.created_at)
        )
        return list(result.scalars().all())

    async def add(self, instance: EvidenceItemORM) -> EvidenceItemORM:
        self._session.add(instance)
        await self._session.flush()
        return instance

    async def delete(self, instance: EvidenceItemORM) -> None:
        await self._session.delete(instance)
        await self._session.flush()
