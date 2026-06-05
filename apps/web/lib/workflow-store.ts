/**
 * CyberSaathi workflow store.
 *
 * Holds the lightweight session state for the entire emergency flow. This
 * is intentionally minimal — anything complex should be re-fetched from
 * the API. We keep session id, current pipeline, complaint id, the
 * incident time the victim reported, and any locally captured answers.
 *
 * The incident time is the victim's reported time of the event, NOT
 * the time they reached CyberSaathi. We preserve it across the whole
 * flow so the complaint package, recovery band, and generated
 * documents all reflect the original timeline.
 */

import { create } from "zustand";

import { api } from "@/lib/api";
import type {
  CaseStateSnapshot,
  ChatMessage,
  ComplaintRecord,
  ExtractedFacts,
  Pipeline,
  RoutingDecision,
} from "@/lib/types";

interface WorkflowState {
  sessionId: string | null;
  currentStep: "intake" | Pipeline | "fall_back" | "complete";
  complaintId: string | null;
  caseId: string | null;
  routing: RoutingDecision | null;
  extractedFacts: ExtractedFacts | null;
  helplineReference: string | null;
  draftDescription: string;
  draftEvidence: string;
  draftAmount: number | null;
  draftPaymentMethod: string | null;
  incidentAtIso: string | null;
  lastError: string | null;
  // LLM Intake Chat state (F015)
  conversationId: string | null;
  caseSnapshot: CaseStateSnapshot | null;
  chatMessages: ChatMessage[];
  setConversation: (conversationId: string, snapshot: CaseStateSnapshot) => void;
  appendChatMessages: (messages: ChatMessage[]) => void;
  setCaseSnapshot: (snapshot: CaseStateSnapshot) => void;
  setDraft: (
    description: string,
    evidence: string,
    amount?: number | null,
    paymentMethod?: string | null,
    incidentAtIso?: string | null,
  ) => void;
  setSession: (sessionId: string) => void;
  setRouting: (routing: RoutingDecision, facts: ExtractedFacts) => void;
  setComplaint: (complaint: ComplaintRecord) => void;
  setHelplineReference: (reference: string) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  ensureSession: () => Promise<string>;
  hydrateFromCaseId: (caseId: string) => Promise<void>;
}

const initial: Pick<
  WorkflowState,
  | "sessionId"
  | "currentStep"
  | "complaintId"
  | "caseId"
  | "routing"
  | "extractedFacts"
  | "helplineReference"
  | "draftDescription"
  | "draftEvidence"
  | "draftAmount"
  | "draftPaymentMethod"
  | "incidentAtIso"
  | "lastError"
  | "conversationId"
  | "caseSnapshot"
  | "chatMessages"
> = {
  sessionId: null,
  currentStep: "intake",
  complaintId: null,
  caseId: null,
  routing: null,
  extractedFacts: null,
  helplineReference: null,
  draftDescription: "",
  draftEvidence: "",
  draftAmount: null,
  draftPaymentMethod: null,
  incidentAtIso: null,
  lastError: null,
  conversationId: null,
  caseSnapshot: null,
  chatMessages: [],
};

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  ...initial,
  setConversation: (conversationId, snapshot) =>
    set({ conversationId, caseSnapshot: snapshot }),
  appendChatMessages: (messages) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, ...messages],
    })),
  setCaseSnapshot: (snapshot) => set({ caseSnapshot: snapshot }),
  setDraft: (description, evidence, amount, paymentMethod, incidentAtIso) =>
    set((state) => ({
      draftDescription: description,
      draftEvidence: evidence,
      draftAmount: amount !== undefined ? amount : state.draftAmount,
      draftPaymentMethod:
        paymentMethod !== undefined ? paymentMethod : state.draftPaymentMethod,
      incidentAtIso:
        incidentAtIso !== undefined ? incidentAtIso : state.incidentAtIso,
    })),
  setSession: (sessionId) => set({ sessionId }),
  setRouting: (routing, facts) =>
    set({
      routing,
      extractedFacts: facts,
      currentStep: routing.pipeline,
    }),
  setComplaint: (complaint) => set({ complaintId: complaint.id }),
  setHelplineReference: (helplineReference) => set({ helplineReference }),
  setError: (lastError) => set({ lastError }),
  reset: () => set({ ...initial }),
  ensureSession: async () => {
    const existing = get().sessionId;
    if (existing) return existing;
    const response = await api.startSession();
    set({ sessionId: response.session_id });
    return response.session_id;
  },
  hydrateFromCaseId: async (caseId: string) => {
    set({ lastError: null, caseId });
    try {
      const complaint = await api.getComplaint(caseId);
      const incidentAtIso = complaint.incident_at ?? null;
      let goldenHourRemaining: number | null = null;
      if (incidentAtIso && complaint.pipeline === "golden_hour") {
        const incidentTime = new Date(incidentAtIso).getTime();
        const goldenHourEnd = incidentTime + 60 * 60 * 1000;
        const now = Date.now();
        goldenHourRemaining = Math.max(0, Math.floor((goldenHourEnd - now) / 1000));
      }
      const routing: RoutingDecision = {
        pipeline: complaint.pipeline,
        confidence: 1,
        reasoning: ["Hydrated from existing case"],
        golden_hour_remaining_seconds: goldenHourRemaining,
        is_financial: complaint.fraud_type === "money_movement_fraud",
      };
      const extractedFacts: ExtractedFacts = {
        utr: null,
        upi_id: null,
        amount: complaint.amount,
        timestamp: incidentAtIso,
        bank: null,
        payment_app: null,
        phone: null,
        handle: null,
        url: null,
        name_mentions: [],
      };
      set({
        complaintId: complaint.id,
        sessionId: complaint.victim_session_id,
        routing,
        extractedFacts,
        incidentAtIso,
        draftDescription: complaint.summary,
        draftPaymentMethod: complaint.payment_method,
        draftAmount: complaint.amount,
        helplineReference: complaint.helpline_reference_number,
        currentStep: complaint.pipeline,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to hydrate case";
      set({ lastError: message });
      throw error;
    }
  },
}));
