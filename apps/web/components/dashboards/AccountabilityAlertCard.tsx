import { Megaphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { StatusBadge } from "@/components/app/StatusBadge";

import type { DashboardAlert } from "@/lib/types";

/**
 * AccountabilityAlertCard — top surface of the Public dashboard. Red
 * surface (border + soft tint) to signal the public-safety nature of
 * the alert. Only renders alerts that are flagged `is_public`.
 */
export function AccountabilityAlertCard({
  alerts,
}: {
  alerts: DashboardAlert[];
}) {
  if (alerts.length === 0) return null;
  return (
    <Card
      className="border-emergency/30 bg-emergency-soft"
      data-testid="public-accountability-alerts"
    >
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2 font-serif-display text-base">
            <Megaphone className="size-4 text-emergency" aria-hidden />
            Accountability alerts
          </CardTitle>
          <CardDescription>
            Clusters that crossed the 50-report, 30-day unresolved
            threshold. Public output is anonymised and aggregate-only.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className="rounded-md border border-emergency/30 bg-card p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {alert.title}
                </p>
                <div className="flex items-center gap-1.5">
                  <StatusBadge
                    label={alert.severity}
                    tone={alert.severity === "high" ? "emergency" : "saffron"}
                  />
                  <Badge
                    variant="outline"
                    className="rounded-full font-mono"
                  >
                    Public
                  </Badge>
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {alert.summary}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
