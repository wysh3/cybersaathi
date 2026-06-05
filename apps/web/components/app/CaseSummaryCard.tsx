import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * CaseSummaryCard — compact grid of facts (amount, UPI ID, UTR, etc.) for
 * the Golden Hour / Documents flows. Always keyboard-readable, never wraps
 * facts in long paragraphs.
 */
export function CaseSummaryCard({
  title,
  description,
  facts,
  columns = 2,
  className,
}: {
  title?: string;
  description?: string;
  facts: ReadonlyArray<{
    label: string;
    value: string | number | null | undefined;
    mono?: boolean;
    highlight?: boolean;
    icon?: LucideIcon;
  }>;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const gridCols =
    columns === 4
      ? "sm:grid-cols-4"
      : columns === 3
        ? "sm:grid-cols-3"
        : "sm:grid-cols-2";
  return (
    <Card className={cn("h-full", className)}>
      <CardContent className="flex flex-col gap-3">
        {title || description ? (
          <div className="flex flex-col gap-0.5">
            {title ? (
              <p className="text-sm font-semibold text-foreground">{title}</p>
            ) : null}
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
        ) : null}
        <dl className={cn("grid grid-cols-1 gap-2", gridCols)}>
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="rounded-md border border-border bg-muted/40 px-3 py-2"
            >
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {fact.label}
              </dt>
              <dd
                className={cn(
                  "mt-0.5 break-words",
                  fact.mono && "font-mono",
                  fact.highlight
                    ? "text-base font-semibold text-foreground"
                    : "text-sm text-foreground/90",
                )}
              >
                {fact.value || fact.value === 0 ? (
                  String(fact.value)
                ) : (
                  <span className="text-muted-foreground/50">—</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
