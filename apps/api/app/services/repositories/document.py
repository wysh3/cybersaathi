"""Generated document repository."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import GeneratedDocumentORM
from app.services.repositories.base import BaseRepo


class DocumentRepo(BaseRepo[GeneratedDocumentORM]):
    """CRUD for generated documents."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)
        self._model = GeneratedDocumentORM

    async def get(self, pk: str) -> GeneratedDocumentORM | None:
        return await self._session.get(GeneratedDocumentORM, pk)

    async def list_for_complaint(
        self, complaint_id: str
    ) -> list[GeneratedDocumentORM]:
        """Return all documents linked to a complaint."""
        stmt = (
            select(GeneratedDocumentORM)
            .where(GeneratedDocumentORM.complaint_id == complaint_id)
            .order_by(GeneratedDocumentORM.created_at)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_all(self) -> list[GeneratedDocumentORM]:
        result = await self._session.execute(
            select(GeneratedDocumentORM).order_by(GeneratedDocumentORM.created_at)
        )
        return list(result.scalars().all())
