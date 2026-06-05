"use client";

import { ClipboardList, FileText, Mail, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * DocumentActionCard — top-of-page card that lets the victim switch
 * between the four generated documents (NCRP / Bank email / Timeline
 * / Checklist). Visual card grid on top of the workspace; the actual
 * editor lives in DocumentEditor.
 */
export type DocumentTabKey =
  | "ncrp_complaint_draft"
  | "bank_dispute_email"
  | "evidence_timeline"
  | "recovery_checklist";

export interface DocumentTabDefinition {
  key: DocumentTabKey;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const DOCUMENT_TABS: ReadonlyArray<DocumentTabDefinition> = [
  {
    key: "ncrp_complaint_draft",
    label: "NCRP draft",
    description: "cybercrime.gov.in",
    icon: FileText,
  },
  {
    key: "bank_dispute_email",
    label: "Bank email",
    description: "Nodal officer",
    icon: Mail,
  },
  {
    key: "evidence_timeline",
    label: "Timeline",
    description: "Chronological",
    icon: ClipboardList,
  },
  {
    key: "recovery_checklist",
    label: "Checklist",
    description: "Recovery actions",
    icon: Sparkles,
  },
];

export function DocumentActionCard({
  label,
  description,
  icon: Icon,
  isReady,
  isActive,
  onClick,
}: {
  label: string;
  description: string;
  icon: LucideIcon;
  isReady: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-document-tab={label}
      data-document-ready={isReady}
      data-document-active={isActive}
      className={cn(
        "group relative flex flex-col items-start gap-1.5 rounded-md border p-3 text-left transition-colors",
        isActive
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-primary/60 hover:bg-primary/5",
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        <span className="text-[11px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p
        className={
          isReady
            ? "text-sm font-semibold text-foreground"
            : "text-sm font-semibold text-muted-foreground"
        }
      >
        {isReady ? "Ready" : "Not generated"}
      </p>
      <p className="text-[11px] text-muted-foreground">{description}</p>
      {isActive ? (
        <span
          aria-hidden
          className="absolute right-2 top-2 inline-block size-1.5 rounded-full bg-primary"
        />
      ) : null}
    </button>
  );
}
