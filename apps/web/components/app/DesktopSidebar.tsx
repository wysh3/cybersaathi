"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Compass,
  Files,
  LayoutDashboard,
  Phone,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Intake", icon: ShieldCheck, match: (p: string) => p === "/" },
  { href: "/documents", label: "Cases", icon: Files, match: (p: string) => p.startsWith("/documents") },
  { href: "/response", label: "Action Guide", icon: Compass, match: (p: string) => p.startsWith("/response") },
  { href: "/accountability", label: "Guidance", icon: ShieldAlert, match: (p: string) => p.startsWith("/accountability") },
  { href: "/dashboards/heatmap", label: "Insights", icon: LayoutDashboard, match: (p: string) => p.startsWith("/dashboards/heatmap") },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3, match: (p: string) => p.startsWith("/dashboard") },
] as const;

export function DesktopSidebar({ onAdminClick }: { onAdminClick?: () => void }) {
  const pathname = usePathname() ?? "/";

  return (
    <aside
      data-app-chrome="true"
      className="hidden min-h-full flex-col border-r border-white/55 bg-white/28 px-6 py-8 backdrop-blur-xl md:flex"
    >
      <Link href="/" className="flex items-center gap-3" aria-label="CyberSaathi home">
        <Logo className="size-12" />
        <div className="flex min-w-0 flex-col">
          <span className="text-xl font-bold tracking-[-0.03em] text-ink-900">
            CyberSaathi
          </span>
          <span className="text-xs font-medium text-ink-600">
            Cybercrime AI Emergency Navigator
          </span>
        </div>
      </Link>

      <nav aria-label="Primary" className="mt-12 flex flex-col gap-5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-16 items-center gap-4 rounded-[20px] border px-5 text-[15px] font-semibold transition-all",
                active
                  ? "border-white/80 bg-white/55 text-sky-700 shadow-glass-soft"
                  : "border-transparent text-ink-700 hover:border-white/70 hover:bg-white/35",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-[20px] border border-white/65 bg-white/42 p-4 shadow-glass-soft">
        <div className="mb-3 inline-flex size-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
          <ShieldCheck className="size-5" aria-hidden />
        </div>
        <p className="text-sm font-semibold text-ink-900">
          Secure. Trusted. Government-ready.
        </p>
        <p className="mt-1 text-xs leading-5 text-ink-600">
          Simulated demo mode. Your safety is the priority.
        </p>
        <a
          href="tel:1930"
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-emergency-soft text-sm font-semibold text-emergency"
        >
          <Phone className="size-4" aria-hidden />
          Call 1930
        </a>
      </div>
    </aside>
  );
}
