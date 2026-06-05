"use client";

/**
 * Journalist dashboard — aggregated trends, accountability alerts, and
 * pre-generated press digests, RTI drafts, and infographic copy.
 * Demo-only; all numbers are seed-data only.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  FileText,
  Image as ImageIcon,
  Mail,
  Megaphone,
  Newspaper,
  Send,
  TriangleAlert,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { MetricCard } from "@/components/app/MetricCard";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";

import { api, ApiError } from "@/lib/api";
import type { ClusterSummary, JournalistDigest } from "@/lib/types";
import { cn } from "@/lib/utils";

import { StoryLeadPanel } from "./StoryLeadPanel";

interface JournalistData {
  total_complaints: number;
  total_amount: number;
  fraud_type_breakdown: Array<{ fraud_type: string; count: number }>;
  state_breakdown: Array<{ state: string; count: number }>;
  alerts: Array<{
    id: string;
    cluster_id: string;
    fraud_type: string;
    report_count: number;
    states: string[];
    first_report_at: string;
    latest_report_at: string;
  }>;
  note: string;
}

const FRAUD_LABEL: Record<string, string> = {
  personal_safety_extortion: "Personal safety & extortion",
  money_movement_fraud: "Money movement fraud",
  device_data_compromise: "Device & data compromise",
  identity_account_control: "Identity & account control",
  platform_content_suspect: "Platform & suspect content",
};

function labelForFraud(value: string): string {
  return FRAUD_LABEL[value] ?? value.replace("_", " ");
}

export function JournalistDashboardClient() {
  const [data, setData] = useState<JournalistData | null>(null);
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [digest, setDigest] = useState<JournalistDigest | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pressEvent, setPressEvent] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (() => {
      setError(null);
    })();
    Promise.all([api.journalistDashboard() as Promise<JournalistData>, api.listClusters()])
      .then(([journalist, clusterResponse]) => {
        if (!active) return;
        setData(journalist);
        setClusters(clusterResponse.clusters);
        const firstAlert =
          clusterResponse.clusters.find((c) => c.is_accountability_alert) ??
          clusterResponse.clusters[0] ??
          null;
        setActiveClusterId(firstAlert?.id ?? null);
        setInitialLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof ApiError
            ? `${err.message}: ${JSON.stringify(err.detail)}`
            : err instanceof Error
              ? err.message
              : "Failed to load journalist dashboard.",
        );
        setInitialLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!activeClusterId) {
      void (() => {
        setDigest(null);
      })();
      return;
    }
    let active = true;
    void (() => {
      setLoading(true);
      setPressEvent(null);
    })();
    api
      .getClusterDigest(activeClusterId)
      .then((response) => {
        if (active) {
          setDigest(response);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof ApiError
            ? `${err.message}: ${JSON.stringify(err.detail)}`
            : err instanceof Error
              ? err.message
              : "Failed to load cluster digest.",
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeClusterId]);

  const fraudRows = useMemo(
    () => data?.fraud_type_breakdown ?? [],
    [data?.fraud_type_breakdown],
  );
  const stateRows = useMemo(
    () => data?.state_breakdown ?? [],
    [data?.state_breakdown],
  );
  const totalFraud = useMemo(
    () => fraudRows.reduce((a, r) => a + r.count, 0) || 1,
    [fraudRows],
  );
  const totalState = useMemo(
    () => stateRows.reduce((a, r) => a + r.count, 0) || 1,
    [stateRows],
  );

  const leadCluster = useMemo(() => {
    const alerts = clusters.filter((c) => c.is_accountability_alert);
    if (alerts.length > 0) return alerts[0];
    if (clusters.length === 0) return null;
    return [...clusters].sort((a, b) => b.report_count - a.report_count)[0];
  }, [clusters]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        eyebrow="Journalist / researcher view"
        title="Trends, accountability alerts, and drafts"
        description="Aggregated data only. Press digests, RTI drafts, and infographic copy are generated from each cluster's own fields — no invented statistics."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/accountability">
              <Megaphone className="size-3.5" aria-hidden />
              Open accountability engine
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </Button>
        }
      />

      <StoryLeadPanel
        cluster={leadCluster}
        onOpen={(clusterId) => setActiveClusterId(clusterId)}
      />

      {error ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertTitle>Journalist dashboard</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          label="Total reports (seed)"
          value={
            data ? data.total_complaints.toLocaleString("en-IN") : "—"
          }
          hint="Across the seed dataset"
          icon={Newspaper}
          loading={initialLoading}
        />
        <MetricCard
          label="Total reported amount"
          value={
            data
              ? `Rs ${Math.round(data.total_amount).toLocaleString("en-IN")}`
              : "—"
          }
          hint="Aggregate self-reported loss"
          tone="primary"
          loading={initialLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard
          title="Fraud type breakdown"
          rows={fraudRows}
          total={totalFraud}
          formatLabel={(row) => labelForFraud(row.fraud_type)}
          loading={initialLoading}
        />
        <BreakdownCard
          title="State breakdown"
          rows={stateRows}
          total={totalState}
          formatLabel={(row) => row.state}
          loading={initialLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-0.5">
            <CardTitle>Accountability clusters</CardTitle>
            <CardDescription>
              Pick a cluster to load its press digest, RTI draft, and
              infographic copy.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="rounded-full">
            {clusters.length} cluster{clusters.length === 1 ? "" : "s"}
          </Badge>
        </CardHeader>
        <CardContent>
          {initialLoading ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <Skeleton key={idx} className="h-16 w-full" />
              ))}
            </div>
          ) : clusters.length === 0 ? (
            <EmptyState
              title="No clusters yet"
              description="Cluster aggregation runs against the seed dataset. Seed more complaints to populate this view."
              icon={Megaphone}
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {clusters.map((cluster) => {
                const isActive = cluster.id === activeClusterId;
                return (
                  <button
                    type="button"
                    key={cluster.id}
                    onClick={() => setActiveClusterId(cluster.id)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-md border p-3 text-left text-sm transition-colors",
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:bg-muted/30",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        {labelForFraud(cluster.fraud_type)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        <span className="num text-foreground">
                          {cluster.report_count}
                        </span>{" "}
                        reports
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {cluster.states.slice(0, 3).join(", ")}
                      {cluster.states.length > 3
                        ? ` +${cluster.states.length - 3}`
                        : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {cluster.is_accountability_alert ? (
                        <StatusBadge label="Alert" tone="emergency" />
                      ) : (
                        <StatusBadge label="Monitor" tone="muted" />
                      )}
                      <span className="num text-[11px] text-muted-foreground">
                        Rs{" "}
                        {Math.round(cluster.total_amount).toLocaleString(
                          "en-IN",
                        )}{" "}
                        total
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-0.5">
            <CardTitle>
              {digest
                ? labelForFraud(digest.cluster.fraud_type)
                : "Cluster outputs"}
            </CardTitle>
            <CardDescription>
              {digest
                ? `${digest.cluster.report_count} reports · Rs ${Math.round(
                    digest.cluster.total_amount,
                  ).toLocaleString("en-IN")} total · ${digest.cluster.states.length} states`
                : "Pick a cluster to load its drafts"}
            </CardDescription>
          </div>
          {digest ? (
            <CardAction>
              <Button
                variant="default"
                size="sm"
                onClick={async () => {
                  try {
                    const event = await api.sendPressDigest(digest.cluster.id);
                    setPressEvent(event.response_summary);
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Failed to simulate press dispatch.",
                    );
                  }
                }}
              >
                <Send className="size-3.5" aria-hidden />
                Simulate press dispatch
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, idx) => (
                <Skeleton key={idx} className="h-12 w-full" />
              ))}
            </div>
          ) : !digest ? (
            <EmptyState
              title="No cluster selected"
              description="Pick a cluster above to load the press digest, RTI draft, and infographic copy."
              icon={FileText}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {pressEvent ? (
                <Alert>
                  <Send aria-hidden />
                  <AlertTitle>Press dispatch (simulated)</AlertTitle>
                  <AlertDescription>{pressEvent}</AlertDescription>
                </Alert>
              ) : null}
              <Tabs defaultValue="digest" className="w-full">
                <TabsList>
                  <TabsTrigger value="digest">
                    <FileText className="size-3.5" aria-hidden /> Press digest
                  </TabsTrigger>
                  <TabsTrigger value="rti">
                    <FileText className="size-3.5" aria-hidden /> RTI draft
                  </TabsTrigger>
                  <TabsTrigger value="infographic">
                    <ImageIcon className="size-3.5" aria-hidden /> Infographic
                  </TabsTrigger>
                  <TabsTrigger value="victim">
                    <Mail className="size-3.5" aria-hidden /> Victim note
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="digest">
                  <DocumentPanel
                    title={digest.digest.title}
                    body={digest.digest.editable_body}
                    kindLabel="Press"
                  />
                </TabsContent>
                <TabsContent value="rti">
                  <DocumentPanel
                    title={digest.rti_draft.title}
                    body={digest.rti_draft.editable_body}
                    kindLabel="RTI"
                  />
                </TabsContent>
                <TabsContent value="infographic">
                  <DocumentPanel
                    title={digest.infographic.title}
                    body={digest.infographic.editable_body}
                    kindLabel="Infographic"
                  />
                </TabsContent>
                <TabsContent value="victim">
                  <DocumentPanel
                    title={
                      digest.victim_notification?.title ??
                      "Victim notification"
                    }
                    body={
                      digest.victim_notification?.editable_body ??
                      "Victim notification not yet generated for this cluster."
                    }
                    kindLabel="Notification"
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BreakdownCard<T extends { count: number }>({
  title,
  rows,
  total,
  formatLabel,
  loading,
}: {
  title: string;
  rows: T[];
  total: number;
  formatLabel: (row: T) => string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription>
          {loading ? "Loading…" : `${rows.length} entries`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-6 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.slice(0, 8).map((row) => {
              const pct = Math.max(2, Math.round((row.count / total) * 100));
              return (
                <li key={formatLabel(row)}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-foreground">{formatLabel(row)}</span>
                    <span className="num text-muted-foreground">
                      {row.count} reports
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentPanel({
  title,
  body,
  kindLabel,
}: {
  title: string;
  body: string;
  kindLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-sm">{title}</CardTitle>
          <CardDescription>Pre-filled editable draft</CardDescription>
        </div>
        <StatusBadge label={kindLabel} tone="saffron" />
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-72">
          <pre className="whitespace-pre-wrap font-sans text-xs text-foreground">
            {body}
          </pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
