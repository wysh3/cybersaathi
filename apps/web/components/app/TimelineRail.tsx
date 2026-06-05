import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * TimelineRail — vertical timeline used by the case file and accountability
 * flows. Each entry is an icon + title + body.
 */
export function TimelineRail({
  entries,
  className,
}: {
  entries: ReadonlyArray<{
    id: string;
    icon: LucideIcon;
    title: string;
    body?: string;
    tone?: "default" | "primary" | "emergency" | "success" | "saffron";
    timestamp?: string;
  }>;
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col gap-0", className)}>
      {entries.map((entry, idx) => {
        const Icon = entry.icon;
        const tone = entry.tone ?? "default";
        const dot =
          tone === "emergency"
            ? "bg-emergency text-white"
            : tone === "success"
              ? "bg-success text-white"
              : tone === "saffron"
                ? "bg-saffron text-white"
                : tone === "primary"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground";
        return (
          <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
            {idx < entries.length - 1 ? (
              <span
                aria-hidden
                className="absolute left-3 top-6 h-[calc(100%-1rem)] w-px bg-border"
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 inline-flex size-6 shrink-0 items-center justify-center rounded-full",
                dot,
              )}
            >
              <Icon className="size-3" aria-hidden />
            </span>
            <div className="flex flex-1 flex-col gap-0.5 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {entry.title}
                </p>
                {entry.timestamp ? (
                  <span className="text-[11px] text-muted-foreground">
                    {entry.timestamp}
                  </span>
                ) : null}
              </div>
              {entry.body ? (
                <p className="text-xs text-muted-foreground">{entry.body}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
