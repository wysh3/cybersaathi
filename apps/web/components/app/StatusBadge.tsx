import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";

export type StatusTone =
  | "default"
  | "primary"
  | "saffron"
  | "emergency"
  | "success"
  | "muted";

const TONE_CLASSES: Record<StatusTone, string> = {
  default: "border-border bg-muted text-foreground",
  primary: "border-primary/20 bg-primary/5 text-primary",
  saffron: "border-saffron/20 bg-saffron-soft text-saffron",
  emergency: "border-emergency/20 bg-emergency-soft text-emergency",
  success: "border-success/20 bg-success-soft text-success",
  muted: "border-border bg-muted text-muted-foreground",
};

/**
 * StatusBadge — small inline tag for pipeline status, account state, etc.
 * Use instead of custom .pill-* classes.
 */
export function StatusBadge({
  label,
  tone = "default",
  icon: Icon,
  className,
}: {
  label: string;
  tone?: StatusTone;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {Icon ? <Icon className="size-3" aria-hidden /> : null}
      {label}
    </Badge>
  );
}
