import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * WorkflowStepper — route-aware step indicator.
 *
 * Implements the pack §6 single 5-step model:
 *   1 Describe  ->  2 Review  ->  3 Act  ->  4 Recovery  ->  5 Documents
 *
 * The Golden Hour path maps Review + Emergency Action + Reference all
 * to Step 3 (Act). The Post-Golden-Hour path maps Step 3 to Recovery
 * Outlook + Next Actions. The caller decides which step is "active" and
 * which are "done" via the `steps` prop.
 *
 * Visual language:
 *   - dot-progress with horizontal lines
 *   - glass surface background
 *   - sky-600 active dot, sky-100 done, ink-300 pending
 *   - large active step label, smaller pending labels
 */
export function WorkflowStepper({
  steps,
  className,
  orientation = "horizontal",
}: {
  steps: ReadonlyArray<{
    id: string;
    label: string;
    description?: string;
    state: "done" | "active" | "pending";
  }>;
  className?: string;
  orientation?: "horizontal" | "vertical";
}) {
  if (orientation === "vertical") {
    return (
      <ol
        className={cn("flex flex-col gap-3", className)}
        aria-label="Pipeline steps"
      >
        {steps.map((step, idx) => (
          <li
            key={step.id}
            className="flex items-start gap-3"
            aria-current={step.state === "active" ? "step" : undefined}
          >
            <span
              className={cn(
                "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                step.state === "done" &&
                  "bg-sky-600 text-white",
                step.state === "active" &&
                  "bg-sky-600 text-white ring-4 ring-sky-200/80",
                step.state === "pending" && "bg-white/80 text-ink-500 ring-1 ring-sky-200",
              )}
              aria-hidden
            >
              {step.state === "done" ? (
                <Check className="size-3.5" />
              ) : (
                <span className="font-mono text-[10px]">{String(idx + 1).padStart(2, "0")}</span>
              )}
            </span>
            <div className="flex flex-col gap-0.5">
              <p
                className={cn(
                  "text-sm font-semibold",
                  step.state === "pending" ? "text-ink-500" : "text-ink-900",
                )}
              >
                {step.label}
              </p>
              {step.description ? (
                <p className="text-xs text-ink-500">{step.description}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol
      className={cn(
        "glass-panel-muted flex w-full items-center gap-1.5 rounded-full px-3 py-2.5",
        className,
      )}
      aria-label="Workflow steps"
    >
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        return (
          <li
            key={step.id}
            className="flex min-w-0 flex-1 items-center gap-2"
            aria-current={step.state === "active" ? "step" : undefined}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <span
                className={cn(
                  "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  step.state === "done" && "bg-sky-600 text-white",
                  step.state === "active" &&
                    "bg-sky-600 text-white ring-[3px] ring-sky-200/80",
                  step.state === "pending" &&
                    "bg-white/90 text-ink-500 ring-1 ring-sky-200",
                )}
                aria-hidden
              >
                {step.state === "done" ? (
                  <Check className="size-3" />
                ) : (
                  <span className="font-mono">{String(idx + 1).padStart(2, "0")}</span>
                )}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span
                  className={cn(
                    "truncate text-[11px] font-semibold uppercase tracking-wider",
                    step.state === "done" && "text-sky-700",
                    step.state === "active" && "text-ink-900",
                    step.state === "pending" && "text-ink-500",
                  )}
                >
                  {step.label}
                </span>
                {step.description ? (
                  <span className="hidden truncate text-[10px] text-ink-500 sm:inline">
                    {step.description}
                  </span>
                ) : null}
              </span>
            </span>
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  "h-px flex-1 min-w-[12px]",
                  step.state === "done" ? "bg-sky-300" : "bg-sky-100/80",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Golden-hour 5-step mapping (pack §6 journey):
 *   1 Describe  -> 2 Review  -> 3 Act (Golden Hour + Reference)  -> 4 Recovery  -> 5 Documents
 *
 * Use this to drive the WorkflowStepper from the active pipeline.
 */
export const JOURNEY_STEPS = [
  { id: "describe", label: "Describe", description: "What happened?" },
  { id: "review", label: "Review", description: "Confirm facts" },
  { id: "act", label: "Act", description: "Call 1930 / next action" },
  { id: "recovery", label: "Recovery", description: "Outlook" },
  { id: "documents", label: "Documents", description: "Complaint package" },
] as const;
