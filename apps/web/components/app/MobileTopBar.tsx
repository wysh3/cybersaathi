"use client";

/**
 * MobileTopBar — compact app bar visible only on small screens.
 * Pack §5: small logo shield + screen title + notification + menu.
 * Carries a quiet role-pill (Golden Hour when active) and a compact
 * 1930 button.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Bell, Menu, Phone, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/StatusBadge";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/lib/workflow-store";

const ROUTE_TITLES: ReadonlyArray<{ prefix: string; title: string }> = [
  { prefix: "/emergency", title: "Emergency" },
  { prefix: "/documents", title: "Case file" },
  { prefix: "/response", title: "Response guide" },
  { prefix: "/dashboards/heatmap", title: "Evidence map" },
  { prefix: "/dashboards/journalist", title: "Journalist" },
  { prefix: "/dashboards/police", title: "Police" },
  { prefix: "/accountability", title: "Accountability" },
  { prefix: "/fall-back", title: "Falling back" },
  { prefix: "/demo", title: "Judge demo" },
];

export function MobileTopBar() {
  const pathname = usePathname() ?? "/";
  const title =
    pathname === "/"
      ? "Intake"
      : (ROUTE_TITLES.find((r) => pathname.startsWith(r.prefix))?.title ?? "CyberSaathi");
  const currentStep = useWorkflowStore((s) => s.currentStep);
  const showGoldenHour = currentStep === "golden_hour";
  return (
    <header
      data-app-chrome="true"
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-white/60 bg-white/72 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 md:hidden",
      )}
    >
      <Link
        href="/"
        className="flex items-center gap-2"
        aria-label="CyberSaathi home"
      >
        <Image
          src="/logo.png"
          alt="CyberSaathi"
          width={36}
          height={36}
          className="shrink-0"
        />
        <span className="font-serif-display text-sm font-semibold tracking-tight text-ink-900">
          {title}
        </span>
      </Link>
      {showGoldenHour ? (
        <StatusBadge
          label="Golden Hour"
          tone="emergency"
          icon={ShieldCheck}
          className="ml-1"
        />
      ) : null}
      <div className="ml-auto flex items-center gap-1.5">
        <Button
          asChild
          size="sm"
          variant="destructive"
          className="h-9 rounded-full px-3 text-xs"
        >
          <a href="tel:1930" aria-label="Call 1930 helpline">
            <Phone data-icon="inline-start" className="size-3.5" aria-hidden />
            1930
          </a>
        </Button>
        <button
          type="button"
          aria-label="Notifications"
          className="inline-flex size-9 items-center justify-center rounded-full border border-white/70 bg-white/60 text-ink-700 transition-colors hover:bg-white"
        >
          <Bell className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Open menu"
          className="inline-flex size-9 items-center justify-center rounded-full border border-white/70 bg-white/60 text-ink-700 transition-colors hover:bg-white"
        >
          <Menu className="size-4" aria-hidden />
        </button>
      </div>
    </header>
  );
}
