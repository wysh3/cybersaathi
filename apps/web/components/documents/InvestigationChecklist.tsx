"use client";

import { Circle, CircleCheck } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useWorkflowStore } from "@/lib/workflow-store";

import {
  INVESTIGATION_STEPS,
  type InvestigationStep,
  type InvestigationStepKey,
} from "./documents-copy";

/**
 * Determine whether a step is complete given the read-only contract
 * from useWorkflowStore. F008 owns the persistence of explicit step
 * state; this function only consumes fields that already exist.
 *
 * Read contract:
 *   - helplineReference != null  -> helpline_called
 *   - documents generated (caller passes `documentsGenerated`)
 *   - currentStep === "complete" -> ncrp_filed + bank_dispute_email
 *     when the user is on the Documents page after reference capture
 *
 * The remaining steps (bank_hold, bank_followup, police_visit,
 * consumer_forum) stay in the "todo" state until F008 ships the
 * explicit persistence.
 */
function isStepComplete(
  step: InvestigationStepKey,
  context: {
    helplineReference: string | null;
    currentStep: string;
    documentsGenerated: boolean;
  },
): boolean {
  switch (step) {
    case "helpline_called":
      return Boolean(context.helplineReference);
    case "bank_dispute_email":
    case "ncrp_filed":
      return context.documentsGenerated && context.currentStep === "complete";
    case "bank_hold":
    case "bank_followup":
    case "police_visit":
    case "consumer_forum":
      return false;
  }
}

/**
 * InvestigationChecklist — adaptive numbered checklist that evolves
 * as the victim completes steps. F005 ships the visual surface and
 * the read contract. F008 owns the persistence of explicit step
 * state and may extend `useWorkflowStore` to track per-step booleans.
 */
export function InvestigationChecklist({
  documentsGenerated = true,
  className,
}: {
  documentsGenerated?: boolean;
  className?: string;
}) {
  const { helplineReference, currentStep } = useWorkflowStore();
  const context = {
    helplineReference,
    currentStep,
    documentsGenerated,
  };

  const completedCount = INVESTIGATION_STEPS.filter((s) =>
    isStepComplete(s.key, context),
  ).length;
  const nextStep = INVESTIGATION_STEPS.find((s) => !isStepComplete(s.key, context));

  return (
    <Card className={className} data-print="surface">
      <CardHeader>
        <div className="flex flex-col gap-1.5">
          <CardTitle>Investigation checklist</CardTitle>
          <CardDescription>
            {completedCount === INVESTIGATION_STEPS.length
              ? "Every step in the Indian escalation path is complete. Keep your case file for the record."
              : nextStep
                ? `Next: ${nextStep.title}`
                : "Continue with the next step in the Indian escalation path."}
          </CardDescription>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {completedCount} / {INVESTIGATION_STEPS.length} done
        </p>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-2">
          {INVESTIGATION_STEPS.map((step) => {
            const done = isStepComplete(step.key, context);
            const isNext = nextStep?.key === step.key;
            return (
              <li
                key={step.key}
                data-step-key={step.key}
                data-step-done={done}
                data-step-next={isNext}
                className={
                  isNext
                    ? "flex items-start gap-3 rounded-md border border-primary/40 bg-primary/5 p-3"
                    : "flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3"
                }
              >
                {done ? (
                  <CircleCheck
                    className="mt-0.5 size-4 shrink-0 text-success"
                    aria-hidden
                  />
                ) : (
                  <Circle
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                )}
                <div className="flex flex-col gap-0.5">
                  <p
                    className={
                      done
                        ? "text-sm font-semibold text-foreground line-through decoration-success/60"
                        : "text-sm font-semibold text-foreground"
                    }
                  >
                    {step.title}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

export { INVESTIGATION_STEPS };
export type { InvestigationStep };
