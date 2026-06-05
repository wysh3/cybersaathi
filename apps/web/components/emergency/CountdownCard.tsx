import { Siren } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

import { EmergencyCTA } from "@/components/app/EmergencyCTA";
import { StatusBadge } from "@/components/app/StatusBadge";

import { formatIncidentLabel } from "./emergency-copy";

/**
 * CountdownCard — big red-bordered card showing the remaining golden
 * hour time, the "Call 1930 Now" primary action, and the "incident
 * reported at" timestamp. Red is intentional and limited to this
 * surface per the design pack.
 */
export function CountdownCard({
  minutes,
  seconds,
  incidentAt,
}: {
  minutes: number;
  seconds: number;
  incidentAt: string | null | null;
}) {
  return (
    <Card
      size="default"
      className="border-emergency/30 bg-emergency-soft"
      data-print="surface"
    >
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emergency">
            Golden Hour · Countdown
          </p>
          <StatusBadge label="Priority action" tone="emergency" icon={Siren} />
        </div>
        <p
          className="num text-5xl font-bold tracking-tight text-emergency sm:text-6xl"
          aria-live="polite"
          data-testid="golden-hour-countdown"
        >
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </p>
        <p className="text-xs text-emergency/90">
          Estimated time left in the 60-minute window. We do not extend or
          refresh this timer. Incident reported at{" "}
          <span className="font-semibold">{formatIncidentLabel(incidentAt)}</span>
          .
        </p>
        <EmergencyCTA
          trailing={
            <p className="text-[11px] text-emergency/80">
              National Cyber Crime Helpline · 24×7 · CyberSaathi does not
              place the call.
            </p>
          }
        />
      </CardContent>
    </Card>
  );
}
