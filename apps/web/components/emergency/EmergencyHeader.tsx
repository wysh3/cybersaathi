import { Siren } from "lucide-react";

import { StatusBadge } from "@/components/app/StatusBadge";

/**
 * EmergencyHeader — top of the Golden Hour page. Red is reserved for
 * this surface only. Uses a serif display font for the title to keep
 * the page title consistent with the rest of the redesign.
 */
export function EmergencyHeader() {
  return (
    <header className="flex flex-col gap-2 border-b border-emergency/30 pb-5">
      <StatusBadge
        label="Emergency Mode"
        tone="emergency"
        icon={Siren}
        className="self-start"
      />
      <h1 className="font-serif-display text-balance text-2xl font-semibold tracking-tight text-emergency sm:text-3xl">
        Golden hour is open. Call 1930 now.
      </h1>
      <p className="max-w-readable text-sm text-emergency/90 sm:text-base">
        Reporting quickly may improve fund-blocking chances. We never
        guarantee recovery. Follow the script below, capture the reference
        number from the helpline, and CyberSaathi will attach it to your
        NCRP and bank dispute drafts.
      </p>
    </header>
  );
}
