"use client";

import { UserRound, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

type View = "citizen" | "journalist";

export function ViewToggle({
  active,
  onChange,
}: {
  active: View;
  onChange: (v: View) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-white/60 bg-white/50 p-1 shadow-glass-soft">
      <button
        onClick={() => onChange("citizen")}
        className={cn(
          "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
          active === "citizen"
            ? "bg-white text-sky-700 shadow-sm"
            : "text-ink-500 hover:text-ink-700",
        )}
      >
        <UserRound className="size-4" />
        For Citizens
      </button>
      <button
        onClick={() => onChange("journalist")}
        className={cn(
          "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
          active === "journalist"
            ? "bg-white text-sky-700 shadow-sm"
            : "text-ink-500 hover:text-ink-700",
        )}
      >
        <Newspaper className="size-4" />
        For Journalists
      </button>
    </div>
  );
}
