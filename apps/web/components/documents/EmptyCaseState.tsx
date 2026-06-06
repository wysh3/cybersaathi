import { FileText } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";

/**
 * EmptyCaseState — shown when the user reaches /documents without
 * an active complaint. Offers the "Start complaint from draft"
 * affordance if the workflow store has extracted facts.
 */
export function EmptyCaseState({
  hasExtractedFacts,
  creating,
  onStartFromDraft,
  lastError,
}: {
  hasExtractedFacts: boolean;
  creating: boolean;
  onStartFromDraft: () => void;
  lastError: string | null;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader
        title="No complaint yet"
        description={
          hasExtractedFacts
            ? "We have your extracted facts. Start a complaint to generate the editable NCRP draft, bank dispute email, evidence timeline, and recovery checklist."
            : "Submit a description in the intake form to start. We redact Aadhaar, PAN, OTPs, card numbers, and passwords before anything is saved."
        }
      />
      <EmptyState
        icon={FileText}
        title="Generate your editable case file"
        description="Once a complaint is started, this page shows the NCRP draft, bank email, evidence timeline, and recovery checklist."
        primaryAction={{ label: "Open intake", href: "/" }}
        secondaryAction={
          hasExtractedFacts
            ? {
                label: creating ? "Starting…" : "Start complaint from draft",
                onClick: onStartFromDraft,
              }
            : undefined
        }
      />
      {lastError ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{lastError}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
