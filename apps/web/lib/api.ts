/**
 * CyberSaathi API client.
 *
 * Talks to the FastAPI backend over fetch. We default to a local proxy
 * (apps/web/app/api) for SSR convenience, but the same client works
 * against the FastAPI host when the API URL is set in the environment.
 */

import type {
  CaseFacts,
  CaseLocation,
  CaseRouting,
  CaseStateSnapshot,
  ChatMessage,
  ClusterSummary,
  ClustersResponse,
  ComplaintRecord,
  ConversationPhase,
  ConversationStatus,
  DashboardAlert,
  ExtractedFacts,
  FallBackTurnRequest,
  FallBackTurnResponse,
  GeneratedDocumentsResponse,
  HeatmapResponse,
  IntakeChatConfirmRequest,
  IntakeChatConfirmResponse,
  IntakeChatStartResponse,
  IntakeChatTurnRequest,
  IntakeChatTurnResponse,
  IntakeConversationRead,
  IntakeRequest,
  IntakeResponse,
  IntelligenceMapResponse,
  JournalistDigest,
  MessageKind,
  MessageRole,
  MockIntegrationEvent,
  NextAction,
  Pipeline,
  PostReportResponse,
  PostReportStepState,
  PublicDashboard,
  RecoveryBand,
  RoutingDecision,
  ShallowCategoriesResponse,
  ShallowCategory,
  SimilarityResult,
  StartSessionResponse,
  StateDistrictResponse,
  UiAction,
  AdminLoginRequest,
  AdminLoginResponse,
  AdminUser,
  AdminStats,
  AdminComplaintListItem,
  AdminComplaintsPage,
  AdminComplaintDetail,
  AdminNoteItem,
  ComplaintStatus,
} from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    throw new ApiError(`Request to ${path} failed (${res.status})`, res.status, detail);
  }
  return (await res.json()) as T;
}

export const api = {
  baseUrl: API_BASE,
  health: () => request<{ status: string }>(`/healthz`),
  startSession: () =>
    request<StartSessionResponse>(`/intake/session`, { method: "POST" }),
  classify: (sessionId: string, body: IntakeRequest) =>
    request<IntakeResponse>(
      `/intake/classify?session_id=${encodeURIComponent(sessionId)}`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
  createComplaint: (body: Record<string, unknown>) =>
    request<ComplaintRecord>(`/complaints`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getComplaint: (id: string) => request<ComplaintRecord>(`/complaints/${id}`),
  generateDocuments: (id: string, kinds: string[] = []) =>
    request<GeneratedDocumentsResponse>(
      `/complaints/${id}/documents`,
      {
        method: "POST",
        body: JSON.stringify({ kinds }),
      },
    ),
  getRecovery: (id: string) =>
    request<RecoveryBand>(`/complaints/${id}/recovery`),
  getSimilarity: (id: string) =>
    request<SimilarityResult>(`/complaints/${id}/similarity`),
  recordHelplineReference: (complaintId: string, referenceNumber: string) =>
    request<{
      complaint_id: string;
      helpline_reference_number: string;
      mock_event: MockIntegrationEvent;
      next_action: string;
    }>(`/integrations/helpline/reference`, {
      method: "POST",
      body: JSON.stringify({ complaint_id: complaintId, reference_number: referenceNumber }),
    }),
  prepareHelplineCall: (complaintId: string) =>
    request<{ event: MockIntegrationEvent; next_action: string }>(
      `/integrations/helpline/prepare`,
      { method: "POST", body: JSON.stringify({ complaint_id: complaintId }) },
    ),
  submitNcrpDraft: (complaintId: string) =>
    request<MockIntegrationEvent>(`/integrations/ncrp/submit`, {
      method: "POST",
      body: JSON.stringify({ complaint_id: complaintId }),
    }),
  sendBankDispute: (complaintId: string) =>
    request<MockIntegrationEvent>(`/integrations/bank/dispute`, {
      method: "POST",
      body: JSON.stringify({ complaint_id: complaintId }),
    }),
  triggerWhatsappSim: (complaintId: string, action: string) =>
    request<MockIntegrationEvent>(`/integrations/whatsapp/simulate`, {
      method: "POST",
      body: JSON.stringify({ complaint_id: complaintId, action }),
    }),
  sendPressDigest: (clusterId: string) =>
    request<MockIntegrationEvent>(`/integrations/press/digest`, {
      method: "POST",
      body: JSON.stringify({ cluster_id: clusterId }),
    }),
  listEvents: (limit = 25) =>
    request<MockIntegrationEvent[]>(`/integrations/events?limit=${limit}`),
  publicDashboard: (state?: string) =>
    request<PublicDashboard>(
      `/dashboards/public${state ? `?state=${encodeURIComponent(state)}` : ""}`,
    ),
  journalistDashboard: () => request<unknown>(`/dashboards/journalist`),
  policeDashboard: () => request<unknown>(`/dashboards/police`),
  heatmap: (state?: string, fraudType?: string) => {
    const params = new URLSearchParams();
    if (state) params.set("state", state);
    if (fraudType) params.set("fraud_type", fraudType);
    const qs = params.toString();
    return request<HeatmapResponse>(`/dashboards/heatmap${qs ? `?${qs}` : ""}`);
  },
  intelligenceMap: (params: { fraudType?: string; metric?: "count" | "amount" } = {}) => {
    const qs = new URLSearchParams();
    if (params.fraudType) qs.set("fraud_type", params.fraudType);
    if (params.metric) qs.set("metric", params.metric);
    const tail = qs.toString();
    return request<IntelligenceMapResponse>(
      `/dashboards/intelligence-map${tail ? `?${tail}` : ""}`,
    );
  },
  intelligenceMapState: (stateId: string, fraudType?: string) => {
    const qs = fraudType ? `?fraud_type=${encodeURIComponent(fraudType)}` : "";
    return request<StateDistrictResponse>(
      `/dashboards/intelligence-map/state/${encodeURIComponent(stateId)}${qs}`,
    );
  },
  shallowCategories: () =>
    request<ShallowCategoriesResponse>(`/intake/shallow-categories`),
  listClusters: () => request<ClustersResponse>(`/clusters`),
  getCluster: (id: string) =>
    request<ClusterSummary>(`/clusters/${id}`),
  getClusterDigest: (id: string) =>
    request<JournalistDigest>(`/clusters/${id}/digest`),
  triggerAccountability: (id: string) =>
    request<ClusterSummary>(`/clusters/${id}/trigger-accountability`, {
      method: "POST",
    }),
  startFallBack: (description: string, evidenceText?: string) =>
    request<FallBackTurnResponse>(`/fall-back/start`, {
      method: "POST",
      body: JSON.stringify({
        case_id: "",
        answers: {},
        description,
        evidence_text: evidenceText ?? null,
      }),
    }),
  advanceFallBack: (body: FallBackTurnRequest) =>
    request<FallBackTurnResponse>(`/fall-back/advance`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // --- Map / Heatmap (added by feat/nandan/heatmap-journalist-citizen-awareness) ---
  mapStates: () =>
    request<{ states: Record<string, number>; total: number }>(`/map/states`),
  mapStateDistricts: (stateName: string) =>
    request<{
      state: string;
      districts: Record<string, number>;
      fraud_types: Record<string, number>;
      total_complaints: number;
      total_amount: number;
      district_count: number;
    }>(`/map/states/${encodeURIComponent(stateName)}/districts`),

  // ---- Post-Report Response Workflows ----
  getPostReportResponse: (complaintId: string) =>
    request<PostReportResponse>(
      `/post-report/${encodeURIComponent(complaintId)}/response`,
    ),
  createPostReportResponse: (
    complaintId: string,
    body: {
      force_refresh?: boolean;
      preferred_language?: string;
      completed_steps?: Record<string, boolean> | null;
    } = {},
  ) =>
    request<PostReportResponse>(
      `/post-report/${encodeURIComponent(complaintId)}/response`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
  updatePostReportStep: (
    complaintId: string,
    stepKey: string,
    status: "todo" | "done" | "skipped" | "blocked",
    notes?: string,
  ) =>
    request<{ success: boolean }>(
      `/post-report/${encodeURIComponent(complaintId)}/steps`,
      {
        method: "PATCH",
        body: JSON.stringify({ step_key: stepKey, status, notes }),
      },
    ),

  // ---- LLM Intake Chat (F015) ----
  startIntakeChat: (body?: { preferred_language?: string; contact_channel?: string }) =>
    request<IntakeChatStartResponse>(`/intake/chat/start`, {
      method: "POST",
      body: JSON.stringify(body ?? { preferred_language: "en", contact_channel: "web" }),
    }),
  sendIntakeChatTurn: (
    conversationId: string,
    body: IntakeChatTurnRequest,
  ) =>
    request<IntakeChatTurnResponse>(
      `/intake/chat/${encodeURIComponent(conversationId)}/turn`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  confirmIntakeChat: (
    conversationId: string,
    body: IntakeChatConfirmRequest,
  ) =>
    request<IntakeChatConfirmResponse>(
      `/intake/chat/${encodeURIComponent(conversationId)}/confirm`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  getIntakeChat: (conversationId: string) =>
    request<IntakeConversationRead>(
      `/intake/chat/${encodeURIComponent(conversationId)}`,
    ),

  // ---- Admin Portal (police-dashboard) ----
  adminLogin: (body: AdminLoginRequest) =>
    request<AdminLoginResponse>(`/admin/auth/login`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminLogout: () =>
    request<{ success: boolean; message: string }>(`/admin/auth/logout`, {
      method: "POST",
    }),
  adminMe: () => request<AdminUser>(`/admin/auth/me`),
  adminStats: () => request<AdminStats>(`/admin/stats`),
  adminComplaints: (params: {
    page?: number;
    page_size?: number;
    search?: string;
    status?: string;
    fraud_type?: string;
    urgency?: string;
    date_from?: string;
    date_to?: string;
    sort_by?: string;
    sort_dir?: string;
  } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    const tail = qs.toString();
    return request<AdminComplaintsPage>(`/admin/complaints${tail ? `?${tail}` : ""}`);
  },
  adminComplaintDetail: (id: string) =>
    request<AdminComplaintDetail>(`/admin/complaints/${encodeURIComponent(id)}`),
  adminUpdateStatus: (complaintId: string, status: ComplaintStatus, note?: string) =>
    request<{ success: boolean; complaint_id: string; old_status: string; new_status: string }>(
      `/admin/complaints/${encodeURIComponent(complaintId)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status, note: note ?? null }),
      },
    ),
  adminAddNote: (complaintId: string, note: string) =>
    request<{ success: boolean; note: AdminNoteItem }>(
      `/admin/complaints/${encodeURIComponent(complaintId)}/notes`,
      {
        method: "POST",
        body: JSON.stringify({ note }),
      },
    ),
  adminExportCsv: (params: {
    search?: string;
    status?: string;
    fraud_type?: string;
    date_from?: string;
    date_to?: string;
  } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, v);
    });
    const tail = qs.toString();
    window.open(`${API_BASE}/admin/export${tail ? `?${tail}` : ""}`, "_blank");
  },
};

export { ApiError };
export type {
  ClusterSummary,
  ClustersResponse,
  ComplaintRecord,
  DashboardAlert,
  ExtractedFacts,
  FallBackTurnRequest,
  FallBackTurnResponse,
  GeneratedDocumentsResponse,
  HeatmapResponse,
  IntakeRequest,
  IntakeResponse,
  IntelligenceMapResponse,
  JournalistDigest,
  MockIntegrationEvent,
  Pipeline,
  PostReportResponse,
  PostReportStepState,
  PublicDashboard,
  RecoveryBand,
  RoutingDecision,
  ShallowCategoriesResponse,
  ShallowCategory,
  SimilarityResult,
  StartSessionResponse,
  StateDistrictResponse,
  // LLM Intake Chat
  CaseFacts,
  CaseLocation,
  CaseRouting,
  CaseStateSnapshot,
  ChatMessage,
  ConversationPhase,
  ConversationStatus,
  IntakeChatConfirmRequest,
  IntakeChatConfirmResponse,
  IntakeChatStartResponse,
  IntakeChatTurnRequest,
  IntakeChatTurnResponse,
  IntakeConversationRead,
  MessageKind,
  MessageRole,
  NextAction,
  UiAction,
  // Admin Portal
  AdminLoginRequest,
  AdminLoginResponse,
  AdminUser,
  AdminStats,
  AdminComplaintListItem,
  AdminComplaintsPage,
  AdminComplaintDetail,
  AdminNoteItem,
  ComplaintStatus,
};
