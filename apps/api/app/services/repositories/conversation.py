"""Repository for LLM intake conversations, messages, and invocations."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import IntakeConversationORM, IntakeMessageORM, LlmInvocationORM
from app.services.repositories.base import BaseRepo


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class ConversationRepo(BaseRepo[IntakeConversationORM]):
    """CRUD for intake_conversations and related tables."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    # ------------------------------------------------------------------
    # Conversations
    # ------------------------------------------------------------------

    async def get_conversation(self, conv_id: str) -> IntakeConversationORM | None:
        return await self._session.get(IntakeConversationORM, conv_id)

    async def create_conversation(
        self,
        victim_session_id: str,
        case_snapshot: dict[str, Any] | None = None,
    ) -> IntakeConversationORM:
        conv = IntakeConversationORM(
            id=_new_id("conv"),
            victim_session_id=victim_session_id,
            status="active",
            current_phase="describe",
            safety_flags=[],
            case_snapshot=case_snapshot or {},
            created_at=_utcnow(),
            updated_at=_utcnow(),
        )
        self._session.add(conv)
        await self._session.flush()
        return conv

    async def update_conversation(
        self,
        conv_id: str,
        *,
        status: Optional[str] = None,
        current_phase: Optional[str] = None,
        case_snapshot: Optional[dict[str, Any]] = None,
        safety_flags: Optional[list[str]] = None,
        complaint_id: Optional[str] = None,
        last_model: Optional[str] = None,
    ) -> IntakeConversationORM | None:
        values: dict[str, Any] = {"updated_at": _utcnow()}
        if status is not None:
            values["status"] = status
        if current_phase is not None:
            values["current_phase"] = current_phase
        if case_snapshot is not None:
            values["case_snapshot"] = case_snapshot
        if safety_flags is not None:
            values["safety_flags"] = safety_flags
        if complaint_id is not None:
            values["complaint_id"] = complaint_id
        if last_model is not None:
            values["last_model"] = last_model

        stmt = (
            update(IntakeConversationORM)
            .where(IntakeConversationORM.id == conv_id)
            .values(**values)
        )
        await self._session.execute(stmt)
        await self._session.flush()
        return await self.get_conversation(conv_id)

    # ------------------------------------------------------------------
    # Messages
    # ------------------------------------------------------------------

    async def create_message(
        self,
        conversation_id: str,
        role: str,
        content_redacted: str,
        *,
        content_original: Optional[str] = None,
        message_kind: str = "chat",
        message_meta: dict[str, Any] | None = None,
    ) -> IntakeMessageORM:
        msg = IntakeMessageORM(
            id=_new_id("msg"),
            conversation_id=conversation_id,
            role=role,
            content_redacted=content_redacted,
            content_original=content_original,
            message_kind=message_kind,
            message_metadata=message_meta or {},
            created_at=_utcnow(),
        )
        self._session.add(msg)
        await self._session.flush()
        return msg

    async def get_messages(
        self, conversation_id: str, limit: int = 50
    ) -> list[IntakeMessageORM]:
        stmt = (
            select(IntakeMessageORM)
            .where(IntakeMessageORM.conversation_id == conversation_id)
            .order_by(IntakeMessageORM.created_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        messages = list(result.scalars().all())
        messages.reverse()  # return oldest-first
        return messages

    async def get_recent_messages(
        self, conversation_id: str, limit: int = 10
    ) -> list[IntakeMessageORM]:
        return await self.get_messages(conversation_id, limit=limit)

    # ------------------------------------------------------------------
    # LLM Invocations
    # ------------------------------------------------------------------

    async def create_invocation(
        self,
        conversation_id: str,
        provider: str,
        model: str,
        prompt_version: str,
        input_summary_redacted: str,
        output_summary_redacted: str,
        latency_ms: int,
        status: str,
        *,
        raw_output_redacted: Optional[str] = None,
        error_type: Optional[str] = None,
        token_usage: dict[str, Any] | None = None,
    ) -> LlmInvocationORM:
        inv = LlmInvocationORM(
            id=_new_id("llm"),
            conversation_id=conversation_id,
            provider=provider,
            model=model,
            prompt_version=prompt_version,
            input_summary_redacted=input_summary_redacted,
            output_summary_redacted=output_summary_redacted,
            raw_output_redacted=raw_output_redacted,
            latency_ms=latency_ms,
            status=status,
            error_type=error_type,
            token_usage=token_usage or {},
            created_at=_utcnow(),
        )
        self._session.add(inv)
        await self._session.flush()
        return inv
