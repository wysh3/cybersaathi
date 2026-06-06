"""Pydantic models for LLM-powered conversational intake.

These models define the chat conversation structure, case state snapshot,
and LLM invocation audit trail for the conversational intake flow.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Conversation & Message models
# ---------------------------------------------------------------------------

ConversationStatus = Literal[
    "active", "ready_to_route", "routed", "completed", "abandoned", "blocked"
]
ConversationPhase = Literal[
    "describe", "clarify", "confirm", "route", "documents"
]
MessageRole = Literal["user", "assistant", "system", "tool"]
MessageKind = Literal["chat", "evidence", "question", "action", "error"]


class IntakeMessageCreate(BaseModel):
    """Payload for creating a message in a conversation."""

    role: MessageRole
    content_redacted: str
    content_original: Optional[str] = None
    message_kind: MessageKind = "chat"
    metadata: dict[str, Any] = Field(default_factory=dict)


class IntakeMessageRead(BaseModel):
    """Message as returned to the frontend."""

    id: str
    conversation_id: str
    role: MessageRole
    content_redacted: str
    message_kind: MessageKind
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class IntakeConversationRead(BaseModel):
    """Conversation metadata returned to the frontend."""

    id: str
    victim_session_id: str
    complaint_id: Optional[str] = None
    status: ConversationStatus
    current_phase: ConversationPhase
    safety_flags: list[str] = Field(default_factory=list)
    case_snapshot: dict[str, Any] = Field(default_factory=dict)
    messages: list[IntakeMessageRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Case state snapshot
# ---------------------------------------------------------------------------

FraudTypeLLM = Literal[
    "upi_fraud",
    "banking_fraud",
    "wallet_fraud",
    "online_payment_fraud",
    "sextortion",
    "job_scam",
    "account_hack",
    "harassment",
    "phishing",
    "other",
    "unknown",
]
PaymentMethodLLM = Literal[
    "upi", "card", "netbanking", "wallet", "cash", "none", "auto", "unknown"
]
DistressLevel = Literal["low", "medium", "high"]
NextAction = Literal[
    "ask_followup",
    "confirm_facts",
    "create_complaint",
    "route_now",
    "fallback_to_deterministic",
]


class CaseLocation(BaseModel):
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None


class CaseFacts(BaseModel):
    utr: Optional[str] = None
    upi_id: Optional[str] = None
    amount: Optional[float] = None
    timestamp: Optional[str] = None  # ISO-format string
    bank: Optional[str] = None
    payment_app: Optional[str] = None
    phone: Optional[str] = None
    handle: Optional[str] = None
    url: Optional[str] = None
    name_mentions: list[str] = Field(default_factory=list)


class CaseRouting(BaseModel):
    pipeline: Optional[str] = None
    confidence: Optional[float] = None
    golden_hour_remaining_seconds: Optional[int] = None
    is_financial: bool = False


class Question(BaseModel):
    id: str
    prompt: str
    reason: str


class CaseStateSnapshot(BaseModel):
    """Canonical case state tracked across conversation turns."""

    language: str = "en"
    user_distress: DistressLevel = "medium"
    incident_summary: str = ""
    fraud_type: FraudTypeLLM = "unknown"
    payment_method: PaymentMethodLLM = "unknown"
    amount: Optional[float] = None
    incident_at: Optional[str] = None  # ISO-format
    location: CaseLocation = Field(default_factory=CaseLocation)
    facts: CaseFacts = Field(default_factory=CaseFacts)
    evidence_texts: list[str] = Field(default_factory=list)
    missing_required_fields: list[str] = Field(default_factory=list)
    routing: Optional[CaseRouting] = None
    complaint_id: Optional[str] = None
    generated_document_ids: list[str] = Field(default_factory=list)
    safety_flags: list[str] = Field(default_factory=list)
    next_action: NextAction = "ask_followup"


# ---------------------------------------------------------------------------
# LLM invocation audit
# ---------------------------------------------------------------------------

LlmInvocationStatus = Literal["success", "retry", "fallback", "failed", "blocked"]


class LlmInvocationRead(BaseModel):
    id: str
    conversation_id: str
    provider: str
    model: str
    prompt_version: str
    input_summary_redacted: str
    output_summary_redacted: str
    latency_ms: int
    status: LlmInvocationStatus
    error_type: Optional[str] = None
    token_usage: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


# ---------------------------------------------------------------------------
# API request / response models
# ---------------------------------------------------------------------------


class StartChatRequest(BaseModel):
    preferred_language: str = "en"
    contact_channel: str = "web"


class StartChatResponse(BaseModel):
    session_id: str
    conversation_id: str
    message: IntakeMessageRead
    case_snapshot: CaseStateSnapshot
    status: ConversationStatus


class ClientContext(BaseModel):
    timezone: str = "Asia/Kolkata"
    current_path: str = "/"
    location: Optional[CaseLocation] = None


class ChatTurnRequest(BaseModel):
    message: str
    evidence_text: Optional[str] = None
    image_base64: Optional[str] = None  # base64-encoded image for vision model
    client_context: ClientContext = Field(default_factory=ClientContext)


class UiAction(BaseModel):
    type: str  # show_fact_review, enable_continue, navigate, show_docs, show_alert
    target: Optional[str] = None  # URL path or component id
    payload: dict[str, Any] = Field(default_factory=dict)


class ChatTurnResponse(BaseModel):
    conversation_id: str
    session_id: str
    assistant_message: IntakeMessageRead
    case_snapshot: CaseStateSnapshot
    routing: Optional[CaseRouting] = None
    complaint: Optional[dict[str, Any]] = None
    documents: list[dict[str, Any]] = Field(default_factory=list)
    ui_actions: list[UiAction] = Field(default_factory=list)
    safety_flags: list[str] = Field(default_factory=list)


class ConfirmRequest(BaseModel):
    confirmed_snapshot: CaseStateSnapshot
    location: CaseLocation


class ConfirmResponse(BaseModel):
    conversation_id: str
    session_id: str
    complaint: Optional[dict[str, Any]] = None
    documents: list[dict[str, Any]] = Field(default_factory=list)
    routing: Optional[CaseRouting] = None
    similarity: Optional[dict[str, Any]] = None
    ui_actions: list[UiAction] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# LLM output schema (what the model must produce)
# ---------------------------------------------------------------------------


class CasePatch(BaseModel):
    """Partial case update from the LLM. All fields optional."""

    incident_summary: Optional[str] = None
    fraud_type: Optional[FraudTypeLLM] = None
    payment_method: Optional[PaymentMethodLLM] = None
    amount: Optional[float] = None
    incident_at: Optional[str] = None
    user_distress: Optional[DistressLevel] = None
    facts: CaseFacts = Field(default_factory=CaseFacts)
    location: CaseLocation = Field(default_factory=CaseLocation)
    evidence_texts_to_add: list[str] = Field(default_factory=list)


class LlmOutput(BaseModel):
    """Structured output the LLM must return as valid JSON."""

    assistant_message: str = ""
    case_patch: CasePatch = Field(default_factory=CasePatch)
    missing_fields: list[str] = Field(default_factory=list)
    next_action: NextAction = "ask_followup"
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    safety_flags: list[str] = Field(default_factory=list)
    questions: list[Question] = Field(default_factory=list)
