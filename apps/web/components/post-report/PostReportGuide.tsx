"use client";

import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PostReportResponse } from "@/lib/types";
import { WorkflowChip } from "./WorkflowChip";
import { ActionCard } from "./ActionCard";
import { DoNotDoCard } from "./DoNotDoCard";
import { EvidenceChecklist } from "./EvidenceChecklist";
import { FollowUpTimeline } from "./FollowUpTimeline";
import { useWorkflowStore } from "@/lib/workflow-store";

export function PostReportGuide({ caseId }: { caseId?: string | null }) {
  const { complaintId } = useWorkflowStore();
  const activeComplaintId = complaintId ?? caseId ?? null;
  const [response, setResponse] = useState<PostReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchResponse = useCallback(async (cid: string, force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const data = force
        ? await api.createPostReportResponse(cid, { force_refresh: true })
        : await api.getPostReportResponse(cid);
      setResponse(data);
    } catch (err) {
      console.error("Failed to load post-complaint response guidance", err);
      toast.error("Could not load checklist guidance.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (activeComplaintId) {
      const timer = window.setTimeout(() => {
        void fetchResponse(activeComplaintId);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [activeComplaintId, fetchResponse]);

  const handleToggleStep = async (stepKey: string, status: "todo" | "done") => {
    if (!activeComplaintId) return;
    try {
      await api.updatePostReportStep(activeComplaintId, stepKey, status);
      // Re-fetch response to sync card item statuses
      const updated = await api.getPostReportResponse(activeComplaintId);
      setResponse(updated);
      toast.success(status === "done" ? "Task marked done." : "Task reset to todo.");
    } catch {
      toast.error("Failed to update step status.");
    }
  };

  if (!activeComplaintId) return null;

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground border rounded-xl bg-card">
        <Loader2 className="size-5 animate-spin text-primary" />
        <span>Loading incident response guide...</span>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3 border rounded-xl bg-card p-6 text-center">
        <p className="text-sm font-semibold text-muted-foreground">
          Incident checklist guide could not be initialized.
        </p>
        <button
          onClick={() => void fetchResponse(activeComplaintId)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <RefreshCw className="size-3.5" />
          <span>Try again</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-print="surface">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-6 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Incident Response Guide</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{response.headline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WorkflowChip workflow={response.primary_workflow} isPrimary />
          {response.secondary_workflows.map((wf) => (
            <WorkflowChip key={wf} workflow={wf} />
          ))}
          <button
            onClick={() => void fetchResponse(activeComplaintId, true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
            title="Regenerate cards based on latest details"
          >
            <RefreshCw className={`size-3 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh Guide</span>
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Side: Dynamic action cards */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Action checklist</h3>
          {response.cards.map((card) => (
            <ActionCard
              key={card.id}
              card={card}
              onToggleStep={handleToggleStep}
            />
          ))}
        </div>

        {/* Right Side: Safeguards & evidence */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Safeguards & evidence</h3>
          <DoNotDoCard items={response.do_not_do} />
          <EvidenceChecklist items={response.evidence_to_preserve} />
        </div>
      </div>

      {/* Full-width Section: Timeline & Escalation Path */}
      <FollowUpTimeline 
        schedule={response.follow_up_schedule} 
        officialPaths={response.official_paths}
      />
      
      <p className="text-[10px] text-muted-foreground italic text-center mt-2 border-t pt-2">
        {response.disclaimer}
      </p>
    </div>
  );
}
