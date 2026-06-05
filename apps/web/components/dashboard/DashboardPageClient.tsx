"use client";

import { useState } from "react";
import { ViewToggle } from "@/components/dashboard/ViewToggle";
import { CitizenDashboard } from "@/components/dashboard/CitizenDashboard";
import { JournalistDashboard } from "@/components/dashboard/JournalistDashboard";

/** Simulated role detection — replace with actual JWT parsing in production */
function getDefaultRole(): "citizen" | "journalist" {
  if (typeof window === "undefined") return "journalist";
  try {
    // Check for a role query param or localStorage override
    const params = new URLSearchParams(window.location.search);
    if (params.get("role") === "citizen") return "citizen";
    if (params.get("role") === "journalist") return "journalist";
    // Default: journalist for new visitors, citizen if coming from a case
    const hasCase = localStorage.getItem("cybersaathi_active_case");
    return hasCase ? "citizen" : "journalist";
  } catch {
    return "journalist";
  }
}

export function DashboardPageClient() {
  const [view, setView] = useState<"citizen" | "journalist">(getDefaultRole());

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            {view === "citizen"
              ? "Your personal case tracker"
              : "Newsroom intelligence — charts, tables, exports"}
          </p>
        </div>
        <ViewToggle active={view} onChange={setView} />
      </div>

      {/* Dashboard body */}
      {view === "citizen" ? <CitizenDashboard /> : <JournalistDashboard />}
    </div>
  );
}
