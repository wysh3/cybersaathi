/**
 * Shared TypeScript types for CyberSaathi.
 *
 * Mirrors the Pydantic models in apps/api/app/models/__init__.py.
 * Keep this file in sync when adding new fields server-side.
 */

export type Pipeline = "golden_hour" | "post_golden_hour" | "fall_back";
export type Severity = "low" | "medium" | "high" | "critical";
export type PaymentMethod = "upi" | "card" | "netbanking" | "wallet" | "cash" | "none" | "auto";
export type FraudType =
  | "personal_safety_extortion"
  | "money_movement_fraud"
  | "device_data_compromise"
  | "identity_account_control"
  | "platform_content_suspect";

export interface GeoPoint {
  state: string;
  district: string;
  pincode?: string;
  lat?: number;
  lng?: number;
}

export interface ExtractedFacts {
  utr: string | null;
  upi_id: string | null;
  amount: number | null;
  timestamp: string | null;
  bank: string | null;
  payment_app: string | null;
  phone: string | null;
  handle: string | null;
  url: string | null;
  name_mentions: string[];
}

export interface RoutingDecision {
  pipeline: Pipeline;
  confidence: number;
  reasoning: string[];
  golden_hour_remaining_seconds: number | null;
  is_financial: boolean;
}

export interface IntakeRequest {
  description: string;
  evidence_text?: string | null;
  incident_at?: string | null;
  amount?: number | null;
  payment_method?: string | null;
  location?: GeoPoint | null;
  contact_channel?: string | null;
  preferred_language?: string;
  extra_pasted_sms?: string | null;
}

export interface IntakeResponse {
  session_id: string;
  extracted_facts: ExtractedFacts;
  routing: RoutingDecision;
  redacted_description: string;
  redacted_evidence: string | null;
  notes: string[];
}

export interface RecoveryBand {
  label: string;
  low_pct: number;
  high_pct: number;
  explanation: string;
  factors: string[];
}

export interface GeneratedDocument {
  id: string;
  complaint_id: string;
  kind: string;
  title: string;
  editable_body: string;
  created_at: string;
  export_status: string;
}

export interface GeneratedDocumentsResponse {
  complaint_id: string;
  documents: GeneratedDocument[];
}

export interface ComplaintRecord {
  id: string;
  fraud_type: FraudType;
  payment_method: PaymentMethod;
  amount: number;
  amount_currency: string;
  severity: Severity;
  urgency_score: number;
  pipeline: Pipeline;
  status: string;
  location: GeoPoint;
  created_at: string;
  incident_at: string;
  is_resolved: boolean;
  has_fir: boolean;
  victim_session_id: string;
  summary: string;
  identifier_ids: string[];
  evidence_item_ids: string[];
  helpline_reference_number: string | null;
  cluster_id: string | null;
}

export interface SimilarityMatch {
  fraud_type: string;
  identifier_type: string;
  identifier_value: string;
  match_count: number;
  sample_districts: string[];
  sample_states: string[];
}

export interface SimilarityResult {
  complaint_id: string;
  matches: SimilarityMatch[];
  counts: { total: number; upi?: number; phone?: number; handle?: number; url?: number };
}

export interface ClusterSummary {
  id: string;
  fraud_type: string;
  states: string[];
  districts: string[];
  report_count: number;
  total_amount: number;
  status: string;
  is_accountability_alert: boolean;
  first_report_at: string;
  latest_report_at: string;
  common_identifier_summary: string[];
}

export interface ClustersResponse {
  accountability_alert_count: number;
  clusters: ClusterSummary[];
}

export interface DashboardAlert {
  id: string;
  cluster_id: string;
  audience: string;
  title: string;
  summary: string;
  severity: Severity;
  created_at: string;
  is_public: boolean;
}

export interface HeatmapBucket {
  state: string;
  district: string;
  count: number;
  total_amount: number;
  top_fraud_types: string[];
}

export interface HeatmapResponse {
  total_complaints: number;
  total_amount: number;
  buckets: HeatmapBucket[];
  generated_at: string;
}

export interface PublicDashboard {
  total_complaints: number;
  total_reported_amount: number;
  top_states: HeatmapBucket[];
  buckets: HeatmapBucket[];
  accountability_alerts: DashboardAlert[];
  note: string;
}

export interface JournalistDigest {
  cluster: ClusterSummary;
  digest: GeneratedDocument;
  infographic: GeneratedDocument;
  rti_draft: GeneratedDocument;
  victim_notification?: GeneratedDocument;
  note: string;
}

export interface DistrictRollup {
  district: string;
  report_count: number;
  total_amount: number;
  top_fraud_type: string | null;
}

export interface StateDistrictResponse {
  state: string;
  state_id: string;
  report_count: number;
  total_amount: number;
  districts: DistrictRollup[];
  note: string;
}

export interface StateIntelligence {
  state: string;
  state_id: string;
  report_count: number;
  total_amount: number;
  district_count: number;
  top_district: string | null;
  top_district_count: number;
  top_fraud_type: string | null;
  intensity_bin: number;
  amount_bin: number;
  has_accountability_alert: boolean;
}

export interface IntelligenceMapResponse {
  metric: "count" | "amount";
  total_complaints: number;
  total_amount: number;
  max_state_count: number;
  max_state_amount: number;
  states: StateIntelligence[];
  accountability_alert_states: string[];
  note: string;
}

export type ShallowCategoryId =
  | "medical_emergency"
  | "domestic_violence"
  | "lost_documents";

export interface ShallowCategory {
  id: ShallowCategoryId;
  label: string;
  headline: string;
  body: string;
  primary_number: string;
  primary_label: string;
  support_lines: string[];
  status: "shallow" | "coming_next";
}

export interface ShallowCategoriesResponse {
  categories: ShallowCategory[];
}

export interface MockIntegrationEvent {
  id: string;
  adapter: string;
  operation: string;
  request_summary: string;
  response_summary: string;
  status: string;
  created_at: string;
}

export interface FallBackQuestion {
  id: string;
  prompt: string;
  options: string[];
  multi_select: boolean;
}

export interface FallBackTurnResponse {
  case_id: string;
  next_questions: FallBackQuestion[];
  current_step: string;
  extracted_facts: ExtractedFacts;
  routing: RoutingDecision;
  notes: string[];
}

export interface StartSessionResponse {
  session_id: string;
}

export interface FallBackTurnRequest {
  case_id: string;
  answers: Record<string, string>;
  description: string;
  evidence_text?: string | null;
}

// ---------------------------------------------------------------------------
// Post-report response workflow types
// ---------------------------------------------------------------------------

export interface PostReportItem {
  label: string;
  reason: string;
  status: "todo" | "done" | "not_applicable";
  deadline: "immediate" | "today" | "24_hours" | "3_days" | "7_days" | "none";
  uses_case_fields: string[];
}

export interface PostReportCard {
  id: string;
  title: string;
  priority: number;
  items: PostReportItem[];
}

export interface OfficialPath {
  label: string;
  url: string;
  mode: "user_opens_external";
  note: string;
}

export interface FollowUpScheduleItem {
  after: string;
  action: string;
}

export interface PostReportResponse {
  id: string;
  complaint_id: string;
  primary_workflow: string;
  secondary_workflows: string[];
  risk_level: "low" | "medium" | "high" | "critical";
  headline: string;
  cards: PostReportCard[];
  do_not_do: string[];
  evidence_to_preserve: string[];
  official_paths: OfficialPath[];
  generated_document_kinds: string[];
  follow_up_schedule: FollowUpScheduleItem[];
  disclaimer: string;
  created_at: string;
  updated_at: string;
}

export interface PostReportStepState {
  id: string;
  complaint_id: string;
  workflow_id: string;
  step_key: string;
  status: "todo" | "done" | "skipped" | "blocked";
  completed_at?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// LLM Intake Chat types (F015)
// ---------------------------------------------------------------------------

export type ConversationStatus = "active" | "ready_to_route" | "routed" | "completed" | "abandoned" | "blocked";
export type ConversationPhase = "describe" | "clarify" | "confirm" | "route" | "documents";
export type MessageRole = "user" | "assistant" | "system" | "tool";
export type MessageKind = "chat" | "evidence" | "question" | "action" | "error";
export type NextAction = "ask_followup" | "confirm_facts" | "create_complaint" | "route_now" | "fallback_to_deterministic";

export interface CaseLocation {
  state: string | null;
  district: string | null;
  pincode: string | null;
}

export interface CaseFacts {
  utr: string | null;
  upi_id: string | null;
  amount: number | null;
  timestamp: string | null;
  bank: string | null;
  payment_app: string | null;
  phone: string | null;
  handle: string | null;
  url: string | null;
  name_mentions: string[];
}

export interface CaseRouting {
  pipeline: string | null;
  confidence: number | null;
  golden_hour_remaining_seconds: number | null;
  is_financial: boolean;
}

export interface CaseStateSnapshot {
  language: string;
  user_distress: "low" | "medium" | "high";
  incident_summary: string;
  fraud_type: string;
  payment_method: string;
  amount: number | null;
  incident_at: string | null;
  location: CaseLocation;
  facts: CaseFacts;
  evidence_texts: string[];
  missing_required_fields: string[];
  routing: CaseRouting | null;
  complaint_id: string | null;
  generated_document_ids: string[];
  safety_flags: string[];
  next_action: NextAction;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content_redacted: string;
  message_kind: MessageKind;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UiAction {
  type: string;
  target?: string | null;
  payload: Record<string, unknown>;
}

export interface IntakeChatStartResponse {
  session_id: string;
  conversation_id: string;
  message: ChatMessage;
  case_snapshot: CaseStateSnapshot;
  status: ConversationStatus;
}

export interface IntakeChatTurnRequest {
  message: string;
  evidence_text?: string | null;
  client_context?: {
    timezone?: string;
    current_path?: string;
    location?: CaseLocation | null;
  };
}

export interface IntakeChatTurnResponse {
  conversation_id: string;
  session_id: string;
  assistant_message: ChatMessage;
  case_snapshot: CaseStateSnapshot;
  routing: CaseRouting | null;
  complaint: Record<string, unknown> | null;
  documents: Record<string, unknown>[];
  ui_actions: UiAction[];
  safety_flags: string[];
}

export interface IntakeChatConfirmRequest {
  confirmed_snapshot: CaseStateSnapshot;
  location: CaseLocation;
}

export interface IntakeChatConfirmResponse {
  conversation_id: string;
  session_id: string;
  complaint: Record<string, unknown> | null;
  documents: Record<string, unknown>[];
  routing: CaseRouting | null;
  similarity: Record<string, unknown> | null;
  ui_actions: UiAction[];
}

export interface IntakeConversationRead {
  id: string;
  victim_session_id: string;
  complaint_id: string | null;
  status: ConversationStatus;
  current_phase: ConversationPhase;
  safety_flags: string[];
  case_snapshot: CaseStateSnapshot;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Admin Portal types (police-dashboard)
// ---------------------------------------------------------------------------

export interface AdminLoginRequest {
  officer_id: string;
  password: string;
}

export interface AdminLoginResponse {
  success: boolean;
  officer_id: string;
  name: string;
  role: string;
  message: string;
}

export interface AdminUser {
  officer_id: string;
  name: string;
  role: "super_admin" | "field_officer";
}

export interface AdminStats {
  total_complaints: number;
  pending_unresolved: number;
  resolved_this_week: number;
  golden_hour_cases: number;
}

export interface AdminComplaintListItem {
  id: string;
  victim_name: string;
  contact: string;
  fraud_type: string;
  amount_lost: number;
  urgency: string;
  filed_at: string;
  status: string;
  pipeline: string;
  has_cluster: boolean;
}

export interface AdminComplaintsPage {
  complaints: AdminComplaintListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AdminNoteItem {
  id: string;
  officer_id: string;
  officer_name: string;
  note: string;
  timestamp: string;
}

export interface AdminComplaintDetail {
  id: string;
  victim_name: string;
  contact: string;
  fraud_type: string;
  platform_used: string;
  transaction_id: string;
  upi_id: string;
  amount: number;
  description: string;
  severity: string;
  urgency_score: number;
  pipeline: string;
  status: string;
  filed_at: string;
  incident_at: string;
  state: string;
  district: string;
  evidence_items: { id: string; kind: string; redacted_text: string; extracted_fields: Record<string, string>; created_at: string | null }[];
  cluster_id: string | null;
  cluster_report_count: number | null;
  notes: AdminNoteItem[];
  is_resolved: boolean;
  has_fir: boolean;
}

export type ComplaintStatus = "pending" | "under_review" | "escalated" | "resolved" | "rejected";
