import { ArrowRight, Megaphone, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { StatusBadge } from "@/components/app/StatusBadge";

import type { ClusterSummary } from "@/lib/types";

/**
 * StoryLeadPanel — top surface of the Journalist dashboard. Builds a
 * one-line "story lead" from a ClusterSummary (no invented stats; only
 * fields the cluster actually carries) so a reporter can pick the
 * most newsworthy pattern in one glance.
 */
export function StoryLeadPanel({
  cluster,
  onOpen,
}: {
  cluster: ClusterSummary | null;
  onOpen?: (clusterId: string) => void;
}) {
  if (!cluster) return null;
  const states = cluster.states.join(", ");
  const identifiers = cluster.common_identifier_summary.slice(0, 3);
  const leadHeadline = buildHeadline(cluster);
  return (
    <Card
      className="border-primary/20 bg-primary/5"
      data-testid="journalist-story-lead"
    >
      <CardHeader>
        <div className="flex flex-col gap-1">
          <StatusBadge
            label="Story lead"
            tone="primary"
            icon={Sparkles}
            className="self-start"
          />
          <CardTitle className="font-serif-display text-xl">
            {leadHeadline}
          </CardTitle>
          <CardDescription>
            Pattern surfaced from the seed dataset. Open the cluster to
            load the press digest, RTI draft, and infographic copy — all
            generated from the cluster&apos;s own fields, no invented
            statistics.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {cluster.is_accountability_alert ? (
            <StatusBadge label="Accountability alert" tone="emergency" icon={Megaphone} />
          ) : null}
          <Badge variant="outline" className="rounded-full font-mono">
            {cluster.fraud_type.replace(/_/g, " ")}
          </Badge>
          <Badge variant="outline" className="rounded-full font-mono">
            {cluster.report_count} reports
          </Badge>
          <Badge variant="outline" className="rounded-full font-mono">
            Rs {Math.round(cluster.total_amount).toLocaleString("en-IN")} total
          </Badge>
        </div>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-card/80 p-3">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              States
            </dt>
            <dd className="text-sm font-medium text-foreground">{states || "—"}</dd>
          </div>
          <div className="rounded-md border border-border bg-card/80 p-3">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Common identifiers
            </dt>
            <dd className="break-all font-mono text-xs text-foreground">
              {identifiers.length > 0 ? identifiers.join(" · ") : "—"}
            </dd>
          </div>
        </dl>
        {onOpen ? (
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto sm:self-start"
            onClick={() => onOpen(cluster.id)}
          >
            Open cluster digest
            <ArrowRight aria-hidden />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function buildHeadline(cluster: ClusterSummary): string {
  const states = cluster.states.length;
  const reports = cluster.report_count;
  const fraud = cluster.fraud_type.replace(/_/g, " ");
  if (cluster.is_accountability_alert) {
    return `${reports} unresolved ${fraud} reports cross the accountability threshold across ${states} state${states === 1 ? "" : "s"}.`;
  }
  return `${reports} ${fraud} reports share identifiers across ${states} state${states === 1 ? "" : "s"} — a clear pattern worth a follow-up.`;
}
