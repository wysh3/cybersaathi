"use client";

/**
 * DocumentPackage — post-golden-hour complaint generation view.
 *
 * Layout (F005 redesign):
 *   - Top: DocumentHeader (eyebrow + serif title + helpline ref + Print)
 *   - 2-col main on desktop (1.2fr editor + 0.8fr sidebar):
 *       Left:  DocumentWorkspace (tabs + editable body + copy/download)
 *       Right: RecoveryOutlookPanel + SimilarReportsPanel +
 *              SubmissionReminderPanel
 *   - Below main: 2-col on desktop:
 *       Left:  InvestigationChecklist (7-step Indian escalation)
 *       Right: EducationNote (post-action cool-down + Share with family)
 *
 * The page is a thin orchestrator. All visual responsibility is
 * delegated to the components in this folder so each piece can be
 * reused or tested in isolation.
 *
 * InvestigationChecklist step persistence is owned by F008.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, ClipboardCheck } from "lucide-react";

import { api, ApiError } from "@/lib/api";
import { useWorkflowStore } from "@/lib/workflow-store";
import type {
  GeneratedDocument,
  Pipeline,
  RecoveryBand,
  SimilarityResult,
} from "@/lib/types";

import { DocumentActionCard, DOCUMENT_TABS } from "./DocumentActionCard";
import { DocumentHeader } from "./DocumentHeader";
import { DocumentWorkspace } from "./DocumentWorkspace";
import { EmptyCaseState } from "./EmptyCaseState";
import { LoadingDocumentsState } from "./LoadingDocumentsState";
import { RecoveryOutlookPanel } from "./RecoveryOutlookPanel";
import { SimilarReportsPanel } from "./SimilarReportsPanel";
import { SubmissionReminderPanel } from "./SubmissionReminderPanel";

export function DocumentPackage() {
  const searchParams = useSearchParams();
  const {
    sessionId,
    complaintId,
    setComplaint,
    setError,
    routing,
    extractedFacts,
    lastError,
    helplineReference,
    draftDescription,
    draftPaymentMethod,
    incidentAtIso,
    hydrateFromCaseId,
    caseId: storeCaseId,
  } = useWorkflowStore();
  const [documents, setDocuments] = useState<GeneratedDocument[] | null>(null);
  const [recovery, setRecovery] = useState<RecoveryBand | null>(null);
  const [similarity, setSimilarity] = useState<SimilarityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeDocKind, setActiveDocKind] = useState<string | null>(null);

  useEffect(() => {
    const caseId = searchParams.get("caseId");
    if (caseId && !complaintId && !storeCaseId) {
      hydrateFromCaseId(caseId).catch(() => {});
    }
  }, [searchParams, complaintId, storeCaseId, hydrateFromCaseId]);

  const loadComplaintDetails = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        const [docs, recoveryResult, similarityResult] = await Promise.all([
          api.generateDocuments(id, []),
          api.getRecovery(id),
          api.getSimilarity(id).catch(() => null),
        ]);
        setDocuments(docs.documents);
        setRecovery(recoveryResult);
        setSimilarity(similarityResult);
        if (docs.documents.length > 0 && !activeDocKind) {
          setActiveDocKind(docs.documents[0].kind);
        }
      } catch (error) {
        const message =
          error instanceof ApiError
            ? `${error.message}: ${JSON.stringify(error.detail)}`
            : error instanceof Error
              ? error.message
              : "Failed to load complaint details.";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [setError, activeDocKind],
  );

  useEffect(() => {
    if (complaintId) {
      void (() => {
        void loadComplaintDetails(complaintId);
      })();
    }
  }, [complaintId, loadComplaintDetails]);

  async function ensureComplaintId(): Promise<string> {
    if (complaintId) return complaintId;
    if (!sessionId) throw new Error("No session. Return to intake first.");
    if (!routing) throw new Error("No routing decision. Return to intake first.");
    setCreating(true);
    try {
      const effectiveIncidentAt =
        incidentAtIso ?? extractedFacts?.timestamp ?? null;
      const complaint = await api.createComplaint({
        session_id: sessionId,
        description: draftDescription || "Reported via Post Golden Hour pipeline.",
        location: { state: "Delhi", district: "New Delhi", pincode: "110001" },
        fraud_type: "money_movement_fraud",
        payment_method:
          draftPaymentMethod && draftPaymentMethod !== "auto" ? draftPaymentMethod : "upi",
        amount: extractedFacts?.amount ?? 0,
        incident_at: effectiveIncidentAt,
        pipeline: routing.pipeline as Pipeline,
        routing_confidence: routing.confidence,
        routing_reasoning: routing.reasoning,
        golden_hour_remaining_seconds: routing.golden_hour_remaining_seconds,
        facts: extractedFacts ?? {
          utr: null,
          upi_id: null,
          amount: null,
          timestamp: null,
          bank: null,
          payment_app: null,
          phone: null,
          handle: null,
          url: null,
          name_mentions: [],
        },
      });
      setComplaint(complaint);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("caseId", complaint.id);
        window.history.replaceState(null, "", url.pathname + url.search);
      }
      return complaint.id;
    } finally {
      setCreating(false);
    }
  }

  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  async function handleStartFromDraft() {
    try {
      await ensureComplaintId();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start complaint.";
      setError(message);
      toast.error(message);
    }
  }

  if (!complaintId) {
    return (
      <EmptyCaseState
        hasExtractedFacts={Boolean(extractedFacts)}
        creating={creating}
        onStartFromDraft={handleStartFromDraft}
        lastError={lastError}
      />
    );
  }

  if (loading || !documents) {
    return <LoadingDocumentsState />;
  }

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
      data-print="root"
    >
      <DocumentHeader
        helplineReference={helplineReference}
        onPrint={handlePrint}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {DOCUMENT_TABS.map((tab) => {
          const isReady = documents.some((d) => d.kind === tab.key);
          return (
            <DocumentActionCard
              key={tab.key}
              label={tab.label}
              description={tab.description}
              icon={tab.icon}
              isReady={isReady}
              isActive={activeDocKind === tab.key}
              onClick={() => {
                setActiveDocKind(tab.key);
                document
                  .getElementById("document-workspace")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div id="document-workspace">
          <DocumentWorkspace
            documents={documents}
          />
        </div>

        <aside className="flex flex-col gap-4">
          <RecoveryOutlookPanel recovery={recovery} />
          <SimilarReportsPanel similarity={similarity} />
          <SubmissionReminderPanel />
        </aside>
      </div>

      <div className="rounded-3xl border border-white/60 bg-white/45 p-8 shadow-glass-soft backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6 mt-8">
        <div className="flex items-start gap-4">
          <div className="mt-1 flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 shadow-glass-soft">
            <ClipboardCheck className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold text-ink-900">
              Step 2: Action Checklist & Escalation Guide
            </h3>
            <p className="text-sm text-ink-600 max-w-2xl leading-relaxed">
              Your drafts and files are successfully generated. Now, view your personalized Incident Response Guide to follow the official government escalation checklist, contact bank nodal officers, and secure your accounts.
            </p>
          </div>
        </div>
        <Link
          href={`/response?caseId=${complaintId}`}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-sky-700 px-6 text-sm font-semibold text-white shadow-lg transition-all hover:bg-sky-800 hover:shadow-sky-700/20 hover:scale-[1.02] active:scale-[0.98] no-print"
        >
          <span>View Action Checklist</span>
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
