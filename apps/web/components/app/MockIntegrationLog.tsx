import { CircleAlert, CircleCheck, CircleDashed, Plug } from "lucide-react";

import { DataPanel } from "@/components/app/DataPanel";
import { cn } from "@/lib/utils";

export type MockEventTone = "pending" | "ok" | "alert" | "info";

const TONE_DOT: Record<MockEventTone, string> = {
  pending: "bg-muted-foreground/40",
  ok: "bg-success",
  alert: "bg-emergency",
  info: "bg-primary",
};

const TONE_ICON: Record<MockEventTone, typeof CircleCheck> = {
  pending: CircleDashed,
  ok: CircleCheck,
  alert: CircleAlert,
  info: Plug,
};

/**
 * MockIntegrationLog — derived event timeline used in the Accountability
 * Room to show what the (simulated) integrations did in response to a
 * cluster trigger. No real APIs are called.
 */
export function MockIntegrationLog({
  events,
  className,
}: {
  events: ReadonlyArray<{
    id: string;
    title: string;
    body?: string;
    tone: MockEventTone;
    timestamp?: string;
  }>;
  className?: string;
}) {
  return (
    <DataPanel
      title="Mock integration log"
      description="Simulated for demo · no real APIs called"
      icon={Plug}
      className={className}
    >
      <ol className="flex flex-col gap-0">
        {events.map((event, idx) => {
          const Icon = TONE_ICON[event.tone];
          return (
            <li
              key={event.id}
              className="relative flex gap-3 pb-4 last:pb-0"
            >
              {idx < events.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute left-3 top-6 h-[calc(100%-1rem)] w-px bg-border"
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card",
                  TONE_DOT[event.tone],
                )}
              >
                <Icon
                  className={cn(
                    "size-3",
                    event.tone === "pending" || event.tone === "info"
                      ? "text-white"
                      : "text-white",
                  )}
                  aria-hidden
                />
              </span>
              <div className="flex flex-1 flex-col gap-0.5 pt-0.5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {event.title}
                  </p>
                  {event.timestamp ? (
                    <span className="text-[11px] text-muted-foreground">
                      {event.timestamp}
                    </span>
                  ) : null}
                </div>
                {event.body ? (
                  <p className="text-xs text-muted-foreground">{event.body}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </DataPanel>
  );
}
