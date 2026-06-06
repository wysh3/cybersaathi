"use client";

/**
 * MobileBottomNav — five-tab bottom navigation (pack §5).
 * Intake / Cases / Evidence / Guidance / More.
 * Uses frosted glass + safe-area padding for notched devices.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Compass,
  Files,
  LayoutDashboard,
  ShieldCheck,
  Shield,
} from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Intake", icon: ShieldCheck, match: (p: string) => p === "/" },
  {
    href: "/documents",
    label: "Cases",
    icon: Files,
    match: (p: string) => p.startsWith("/documents"),
  },
  {
    href: "/dashboards/heatmap",
    label: "Insights",
    icon: LayoutDashboard,
    match: (p: string) =>
      p.startsWith("/dashboards") ||
      p.startsWith("/demo"),
  },
  {
    href: "/response",
    label: "Guide",
    icon: Compass,
    match: (p: string) => p.startsWith("/response"),
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: BarChart3,
    match: (p: string) => p.startsWith("/dashboard"),
  },
] as const;

export function MobileBottomNav({ onAdminClick }: { onAdminClick?: () => void }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label="Primary"
      data-app-chrome="true"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/60 bg-white/72 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.match(pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors",
                  active
                    ? "text-sky-700"
                    : "text-ink-500 hover:text-ink-700",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full",
                    active && "bg-sky-100/80",
                  )}
                >
                  <Icon
                    data-icon="inline-end"
                    className={cn(
                      "size-[18px]",
                      active ? "text-sky-700" : "text-ink-500",
                    )}
                    aria-hidden
                  />
                </span>
                <span className="leading-none">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
