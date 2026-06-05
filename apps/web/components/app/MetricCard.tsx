import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";

export type MetricTone = "default" | "primary" | "saffron" | "emergency" | "success" | "muted";

/**
 * MetricCard — compact numeric tile used in dashboard headers.
 *
 * Single primary number, optional small unit/hint, optional trend arrow.
 * Tone maps to a semantic color (primary / saffron / emergency / success).
 */
export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
  trend,
  loading,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: MetricTone;
  icon?: LucideIcon;
  trend?: {
    direction: "up" | "down" | "flat";
    label: string;
  };
  loading?: boolean;
  className?: string;
}) {
  const valueTone =
    tone === "emergency"
      ? "text-emergency"
      : tone === "success"
        ? "text-success"
        : tone === "saffron"
          ? "text-saffron"
          : tone === "primary"
            ? "text-primary"
            : tone === "muted"
              ? "text-muted-foreground"
              : "text-foreground";
  return (
    <Card size="sm" className={cn("h-full", className)}>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {Icon ? (
            <Icon
              data-icon="inline-end"
              className="text-muted-foreground"
              aria-hidden
            />
          ) : null}
        </div>
        {loading ? (
          <div className="h-7 w-24 animate-pulse rounded bg-muted" />
        ) : (
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums leading-none",
              valueTone,
            )}
          >
            {value}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {trend ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-semibold",
                trend.direction === "up" && "text-success",
                trend.direction === "down" && "text-emergency",
                trend.direction === "flat" && "text-muted-foreground",
              )}
            >
              {trend.direction === "up" ? (
                <ArrowUpRight className="size-3" aria-hidden />
              ) : trend.direction === "down" ? (
                <ArrowDownRight className="size-3" aria-hidden />
              ) : null}
              {trend.label}
            </span>
          ) : null}
          {hint ? <span>{hint}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
