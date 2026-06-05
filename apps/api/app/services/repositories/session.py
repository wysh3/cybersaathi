"""Victim session repository."""

from __future__ import annotations

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import VictimSessionORM
from app.services.repositories.base import BaseRepo


class SessionRepo(BaseRepo[VictimSessionORM]):
    """CRUD for victim sessions."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)
        self._model = VictimSessionORM

    async def get(self, pk: str) -> VictimSessionORM | None:
        return await self._session.get(VictimSessionORM, pk)

    async def add(self, instance: VictimSessionORM) -> VictimSessionORM:
        self._session.add(instance)
        await self._session.flush()
        return instance

    async def update_step(
        self, session_id: str, step: str
    ) -> VictimSessionORM | None:
        """Update the current_step field and return the updated row."""
        stmt = (
            update(VictimSessionORM)
            .where(VictimSessionORM.id == session_id)
            .values(current_step=step)
        )
        await self._session.execute(stmt)
        await self._session.flush()
        return await self.get(session_id)
