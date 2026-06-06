"""Pydantic models for CyberSaathi backend.

The shapes mirror the conceptual records in AGENTS.md section 5. They are kept
explicit (no RootModel, no Ellipsis defaults) and use ``Annotated`` for query
parameters when needed.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


Pipeline = Literal["golden_hour", "post_golden_hour", "fall_back"]
Severity = Literal["low", "medium", "high", "critical"]


class GeoPoint(BaseModel):
    """District-level geo data. Never includes a street address."""

    state: str
    district: str
    pincode: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class ComplaintBase(BaseModel):
    """Common fields shared by complaints in seed data and intake."""

    fraud_type: str
    payment_method: str
    amount: float
    amount_currency: str = "INR"
    severity: Severity
    urgency_score: int = Field(ge=0, le=100)
    pipeline: Pipeline
    status: str
    location: GeoPoint
    created_at: datetime
    incident_at: datetime
    is_resolved: bool = False
    has_fir: bool = False


class ComplaintRecord(ComplaintBase):
    """Full complaint record as stored in the seed index."""

    id: str
    victim_session_id: str
    summary: str
    identifier_ids: list[str] = Field(default_factory=list)
    evidence_item_ids: list[str] = Field(default_factory=list)
    helpline_reference_number: Optional[str] = None
    cluster_id: Optional[str] = None


class ScamIdentifier(BaseModel):
    id: str
    type: str
    value: str
    normalized_value: str
    confidence: float = Field(ge=0.0, le=1.0)
    source_complaint_ids: list[str] = Field(default_factory=list)


class ClusterRecord(BaseModel):
    id: str
    status: Literal["monitor", "escalated", "stable", "resolved"]
    fraud_type: str
    member_complaint_ids: list[str]
    common_identifier_ids: list[str]
    districts: list[str]
    states: list[str]
    first_report_at: datetime
    latest_report_at: datetime
    total_amount: float
    report_count: int
    trigger_reason: Optional[str] = None


class EvidenceItem(BaseModel):
    id: str
    complaint_id: str
    kind: Literal["sms", "screenshot", "voice", "narrative"]
    source: str
    original_text: str
    redacted_text: str
    extracted_fields: dict[str, str] = Field(default_factory=dict)
    created_at: datetime


class ExtractedFacts(BaseModel):
    """Mock OCR/NER output for a single piece of evidence."""

    utr: Optional[str] = None
    upi_id: Optional[str] = None
    amount: Optional[float] = None
    timestamp: Optional[datetime] = None
    bank: Optional[str] = None
    payment_app: Optional[str] = None
    phone: Optional[str] = None
    handle: Optional[str] = None
    url: Optional[str] = None
    name_mentions: list[str] = Field(default_factory=list)


class RoutingDecision(BaseModel):
    pipeline: Pipeline
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: list[str]
    golden_hour_remaining_seconds: Optional[int] = None
    is_financial: bool


class IntakeRequest(BaseModel):
    """What the frontend sends when the user describes what happened."""

    description: str
    evidence_text: Optional[str] = None
    incident_at: Optional[datetime] = None
    amount: Optional[float] = None
    payment_method: Optional[str] = None
    location: Optional[GeoPoint] = None
    contact_channel: Optional[str] = None
    preferred_language: str = "en"
    extra_pasted_sms: Optional[str] = None


class IntakeResponse(BaseModel):
    session_id: str
    extracted_facts: ExtractedFacts
    routing: RoutingDecision
    redacted_description: str
    redacted_evidence: Optional[str] = None
    notes: list[str] = Field(default_factory=list)


class RecoveryBand(BaseModel):
    label: str
    low_pct: int
    high_pct: int
    explanation: str
    factors: list[str]


class DocumentKind:
    NCRP_DRAFT = "ncrp_complaint_draft"
    BANK_DISPUTE = "bank_dispute_email"
    EVIDENCE_TIMELINE = "evidence_timeline"
    RTI_DRAFT = "rti_draft"
    JOURNALIST_DIGEST = "journalist_digest"
    INFOGRAPHIC_COPY = "infographic_copy"
    VICTIM_NOTIFICATION = "victim_notification"
    RECOVERY_CHECKLIST = "recovery_checklist"


DOCUMENT_KINDS = (
    DocumentKind.NCRP_DRAFT,
    DocumentKind.BANK_DISPUTE,
    DocumentKind.EVIDENCE_TIMELINE,
    DocumentKind.RTI_DRAFT,
    DocumentKind.JOURNALIST_DIGEST,
    DocumentKind.INFOGRAPHIC_COPY,
    DocumentKind.VICTIM_NOTIFICATION,
    DocumentKind.RECOVERY_CHECKLIST,
)


class GeneratedDocument(BaseModel):
    id: str
    complaint_id: str
    kind: str
    title: str
    editable_body: str
    created_at: datetime
    export_status: str = "draft"


class GeneratedDocumentsResponse(BaseModel):
    complaint_id: str
    documents: list[GeneratedDocument]


class SimilarityResult(BaseModel):
    complaint_id: str
    matches: list["SimilarityMatch"]
    counts: dict[str, int]


class SimilarityMatch(BaseModel):
    fraud_type: str
    identifier_type: str
    identifier_value: str
    match_count: int
    sample_districts: list[str]
    sample_states: list[str]


class HeatmapBucket(BaseModel):
    state: str
    state_id: str = ""
    district: str
    count: int
    total_amount: float
    top_fraud_types: list[str]


class HeatmapResponse(BaseModel):
    total_complaints: int
    total_amount: float
    buckets: list[HeatmapBucket]
    generated_at: datetime


class ClusterSummary(BaseModel):
    id: str
    fraud_type: str
    states: list[str]
    districts: list[str]
    report_count: int
    total_amount: float
    status: str
    is_accountability_alert: bool
    first_report_at: datetime
    latest_report_at: datetime
    common_identifier_summary: list[str]


class ClustersResponse(BaseModel):
    accountability_alert_count: int
    clusters: list[ClusterSummary]


class DashboardAlert(BaseModel):
    id: str
    cluster_id: str
    audience: str
    title: str
    summary: str
    severity: Severity
    created_at: datetime
    is_public: bool


class PublicDashboardResponse(BaseModel):
    total_complaints: int
    total_reported_amount: float
    top_states: list[HeatmapBucket]
    buckets: list[HeatmapBucket] = Field(default_factory=list)
    accountability_alerts: list[DashboardAlert]
    note: str


class JournalistDigestResponse(BaseModel):
    cluster: ClusterSummary
    digest: GeneratedDocument
    infographic: GeneratedDocument
    rti_draft: GeneratedDocument
    victim_notification: Optional[GeneratedDocument] = None
    note: str


class MockIntegrationEvent(BaseModel):
    id: str
    adapter: str
    operation: str
    request_summary: str
    response_summary: str
    status: Literal["simulated_success", "simulated_pending", "simulated_failed"]
    created_at: datetime


class FallBackQuestion(BaseModel):
    id: str
    prompt: str
    options: list[str]
    multi_select: bool = False


class FallBackTurnRequest(BaseModel):
    case_id: str
    answers: dict[str, str] = Field(default_factory=dict)
    description: str
    evidence_text: Optional[str] = None


class FallBackTurnResponse(BaseModel):
    case_id: str
    next_questions: list[FallBackQuestion]
    current_step: str
    extracted_facts: ExtractedFacts
    routing: RoutingDecision
    notes: list[str] = Field(default_factory=list)


class HelplineReferenceRequest(BaseModel):
    complaint_id: str
    reference_number: str


class HelplineReferenceResponse(BaseModel):
    complaint_id: str
    helpline_reference_number: str
    mock_event: MockIntegrationEvent
    next_action: str


class PostReportItem(BaseModel):
    label: str
    reason: str
    status: Literal["todo", "done", "not_applicable"] = "todo"
    deadline: Literal["immediate", "today", "24_hours", "3_days", "7_days", "none"] = "none"
    uses_case_fields: list[str] = Field(default_factory=list)


class PostReportCard(BaseModel):
    id: str
    title: str
    priority: int
    items: list[PostReportItem] = Field(default_factory=list)


class OfficialPath(BaseModel):
    label: str
    url: str
    mode: Literal["user_opens_external"] = "user_opens_external"
    note: str


class FollowUpScheduleItem(BaseModel):
    after: str
    action: str


class PostReportResponse(BaseModel):
    id: str
    complaint_id: str
    primary_workflow: str
    secondary_workflows: list[str] = Field(default_factory=list)
    risk_level: Literal["low", "medium", "high", "critical"]
    headline: str
    cards: list[PostReportCard] = Field(default_factory=list)
    do_not_do: list[str] = Field(default_factory=list)
    evidence_to_preserve: list[str] = Field(default_factory=list)
    official_paths: list[OfficialPath] = Field(default_factory=list)
    generated_document_kinds: list[str] = Field(default_factory=list)
    follow_up_schedule: list[FollowUpScheduleItem] = Field(default_factory=list)
    disclaimer: str = "CyberSaathi prepared this guidance; it has not filed or submitted anything for you."
    created_at: datetime
    updated_at: datetime


class PostReportStepState(BaseModel):
    id: str
    complaint_id: str
    workflow_id: str
    step_key: str
    status: Literal["todo", "done", "skipped", "blocked"] = "todo"
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None


class PostReportResponseRequest(BaseModel):
    force_refresh: bool = False
    preferred_language: str = "en"
    completed_steps: Optional[dict[str, bool]] = None


class UpdatePostReportStepsRequest(BaseModel):
    step_key: str
    status: Literal["todo", "done", "skipped", "blocked"]
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Admin Portal Pydantic models (police-dashboard)
# ---------------------------------------------------------------------------


class AdminLoginRequest(BaseModel):
    officer_id: str
    password: str


class AdminLoginResponse(BaseModel):
    success: bool
    officer_id: str
    name: str
    role: str
    message: str


class AdminComplaintListItem(BaseModel):
    id: str
    victim_name: str = "(anonymous)"
    contact: str = "(anonymous)"
    fraud_type: str
    amount_lost: float
    urgency: str
    filed_at: datetime
    status: str
    pipeline: str
    has_cluster: bool = False


class AdminComplaintDetail(BaseModel):
    id: str
    victim_name: str = "(anonymous)"
    contact: str = "(anonymous)"
    fraud_type: str
    platform_used: str = ""
    transaction_id: str = ""
    upi_id: str = ""
    amount: float
    description: str
    severity: str
    urgency_score: int
    pipeline: str
    status: str
    filed_at: datetime
    incident_at: datetime
    state: str
    district: str
    evidence_items: list[dict] = Field(default_factory=list)
    cluster_id: Optional[str] = None
    cluster_report_count: Optional[int] = None
    notes: list["AdminNoteItem"] = Field(default_factory=list)
    is_resolved: bool = False
    has_fir: bool = False


class AdminNoteItem(BaseModel):
    id: str
    officer_id: str
    officer_name: str
    note: str
    timestamp: datetime


class AdminNoteRequest(BaseModel):
    note: str


class AdminStatusUpdateRequest(BaseModel):
    status: Literal["pending", "under_review", "escalated", "resolved", "rejected"]
    note: Optional[str] = None


class AdminStatsResponse(BaseModel):
    total_complaints: int
    pending_unresolved: int
    resolved_this_week: int
    golden_hour_cases: int


class AdminComplaintsPage(BaseModel):
    complaints: list[AdminComplaintListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class AdminAuditLogEntry(BaseModel):
    id: str
    complaint_id: Optional[str]
    officer_id: str
    officer_name: str
    action: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    note: Optional[str] = None
    timestamp: datetime


# Pydantic v2 forward ref resolution
SimilarityResult.model_rebuild()
AdminComplaintDetail.model_rebuild()

