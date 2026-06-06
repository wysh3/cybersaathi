"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronsLeft,
  ChevronsRight,
  Compass,
  Files,
  LayoutDashboard,
  Phone,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Intake", icon: ShieldCheck, match: (p: string) => p === "/" },
  { href: "/documents", label: "Cases", icon: Files, match: (p: string) => p.startsWith("/documents") },
  { href: "/response", label: "Action Guide", icon: Compass, match: (p: string) => p.startsWith("/response") },
  { href: "/accountability", label: "Guidance", icon: ShieldAlert, match: (p: string) => p.startsWith("/accountability") },
  { href: "/dashboards/heatmap", label: "Insights", icon: LayoutDashboard, match: (p: string) => p.startsWith("/dashboards/heatmap") },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3, match: (p: string) => p === "/dashboard" || p.startsWith("/dashboard/") },
] as const;

const COLLAPSED_W = "w-[72px]";
const EXPANDED_W = "w-[260px]";
const spring = "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]";

export function DesktopSidebar({ onAdminClick }: { onAdminClick?: () => void }) {
  const pathname = usePathname() ?? "/";
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      data-app-chrome="true"
      className={cn(
        "sticky top-0 hidden h-dvh flex-col overflow-hidden border-r border-white/55 bg-white/28 backdrop-blur-xl md:flex",
        spring,
        collapsed ? COLLAPSED_W : EXPANDED_W,
      )}
    >
      <Link
        href="/"
        className={cn(
          "flex shrink-0 items-center",
          collapsed ? "justify-center pt-6" : "gap-3 px-6 pt-8",
        )}
        aria-label="CyberSaathi home"
      >
        <Image
          src="/logo.png"
          alt="CyberSaathi"
          width={52}
          height={52}
          className="shrink-0"
        />
        <div className={cn("flex min-w-0 flex-col", collapsed && "hidden")}>
          <span className="truncate text-xl font-bold leading-tight tracking-[-0.025em] text-ink-900">
            CyberSaathi
          </span>
        </div>
      </Link>

      <nav aria-label="Primary" className="mt-10 flex flex-1 flex-col gap-3 px-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-14 shrink-0 items-center rounded-[10px] border text-[15px] font-semibold",
                spring,
                collapsed ? "justify-center px-0" : "gap-4 px-4",
                active
                  ? "border-white/80 bg-white/55 text-sky-700 shadow-glass-soft"
                  : "border-transparent text-ink-700 hover:border-white/70 hover:bg-white/35",
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className={cn(collapsed && "hidden")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div
        className={cn(
          "mx-3 mb-2 space-y-2 rounded-[10px] border border-white/65 bg-white/42 p-3 shadow-glass-soft",
          spring,
          collapsed && "pointer-events-none scale-95 opacity-0",
        )}
      >
        {onAdminClick ? (
          <button
            type="button"
            onClick={onAdminClick}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-sky-200 bg-white/70 text-sm font-semibold text-sky-800 hover:bg-white"
          >
            <ShieldCheck className="size-4" aria-hidden />
            Authority Access
          </button>
        ) : null}
        <a
          href="tel:1930"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-emergency-soft text-sm font-semibold text-emergency"
        >
          <Phone className="size-4" aria-hidden />
          Call 1930
        </a>
      </div>

      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "mx-3 mb-4 flex shrink-0 items-center justify-center rounded-xl border transition-colors",
          collapsed
            ? "h-10 border-white/60 bg-white/30"
            : "h-9 border-transparent text-ink-500 hover:border-white/60 hover:bg-white/30 hover:text-ink-700",
        )}
      >
        {collapsed ? (
          <ChevronsRight className="size-4 text-ink-600" />
        ) : (
          <ChevronsLeft className="size-4" />
        )}
      </button>
    </aside>
  );
}
