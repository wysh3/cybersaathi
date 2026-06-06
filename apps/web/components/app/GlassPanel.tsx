/**
 * GlassPanel — translucent glass surface (pack §6).
 * Wrapper around .glass-panel utility. Use for primary panels (intake card,
 * emergency card, document workspace).
 *
 * Variants:
 *  - default:  rgba(255,255,255,0.78), blur 18px, soft shadow
 *  - strong:   rgba(255,255,255,0.86), blur 22px, stronger shadow (top-level page frames)
 *  - muted:    rgba(248,252,255,0.68), blur 14px, subtle (secondary panels)
 */

import { cn } from "@/lib/utils";

export function GlassPanel({
  children,
  variant = "default",
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  variant?: "default" | "strong" | "muted";
  className?: string;
  as?: "div" | "section" | "article" | "aside" | "header" | "footer";
}) {
  return (
    <Tag
      className={cn(
        variant === "strong" && "glass-panel-strong",
        variant === "default" && "glass-panel",
        variant === "muted" && "glass-panel-muted",
        "rounded-xl",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
