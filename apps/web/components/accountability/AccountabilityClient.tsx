"use client";

/**
 * Accountability engine — intelligence room.
 *
 * A cluster escalates when it crosses the 50-report, 30-day unresolved
 * threshold and has no FIR or resolution status. CyberSaathi then
 * generates a public alert, journalist digest, RTI draft, infographic
 * copy, and a victim notification — all from the cluster's own fields,
 * never invented.
 *
 * Layout:
 *   - Eyebrow + title
 *   - 5 metric tiles
 *   - Escalation pipeline (horizontal stepper)
 *   - Cluster selector (left) and cluster outputs (right)
 *   - Identifiers + story lead (right)
 *   - Mock integration event log (full width)
 *   - Disclosure rules
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleCheck,
  Compass,
  FileText,
  Image as ImageIcon,
  Mail,
  Megaphone,
  ScrollText,
  Send,
  Sparkles,
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
import { PrivacyNotice } from "@/components/app/PrivacyNotice";
import { StatusBadge } from "@/components/app/StatusBadge";
import { WorkflowStepper } from "@/components/app/WorkflowStepper";
import { MockIntegrationLog } from "@/components/app/MockIntegrationLog";

import { api, ApiError } from "@/lib/api";
import type {
  ClusterSummary,
  JournalistDigest,
  MockIntegrationEvent,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const FRAUD_LABEL: Record<string, string> = {
  personal_safety_extortion: "Personal safety & extortion",
  money_movement_fraud: "Money movement fraud",
  device_data_compromise: "Device & data compromise",
  identity_account_control: "Identity & account control",
  platform_content_suspect: "Platform & suspect content",
};

const PIPELINE_STAGES = [
  { key: "intake", label: "Incoming reports" },
  { key: "similarity", label: "Similarity match" },
  { key: "cluster", label: "Cluster threshold" },
  { key: "alert", label: "Public alert" },
  { key: "escalation", label: "Press + RTI + victim" },
] as const;

export function AccountabilityClient() {
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [digest, setDigest] = useState<JournalistDigest | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);
  const [pressEvent, setPressEvent] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (() => {
      setLoading(true);
    })();
    api
      .listClusters()
      .then((response) => {
        if (!active) return;
        setClusters(response.clusters);
        const firstAlert =
          response.clusters.find((c) => c.is_accountability_alert) ??
          response.clusters[0] ??
          null;
        setActiveClusterId(firstAlert?.id ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof ApiError
            ? `${err.message}: ${JSON.stringify(err.detail)}`
            : err instanceof Error
              ? err.message
              : "Failed to load clusters.",
        );
        setLoading(false);
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
      setPressEvent(null);
    })();
    api
      .getClusterDigest(activeClusterId)
      .then((response) => {
        if (active) setDigest(response);
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
      });
    return () => {
      active = false;
    };
  }, [activeClusterId]);

  const activeCluster = useMemo(
    () => clusters.find((c) => c.id === activeClusterId) ?? null,
    [clusters, activeClusterId],
  );

  const mockEventLog = useMemo(
    () => buildMockEventLog(activeCluster, digest, pressEvent),
    [activeCluster, digest, pressEvent],
  );

  async function triggerAlert() {
    if (!activeClusterId) return;
    setTriggering(true);
    setError(null);
    setTriggerMessage(null);
    try {
      await api.triggerAccountability(activeClusterId);
      setTriggerMessage(
        "Public alert, journalist digest, RTI draft, infographic, and victim notification are ready.",
      );
      const response = await api.listClusters();
      setClusters(response.clusters);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${err.message}: ${JSON.stringify(err.detail)}`
          : err instanceof Error
            ? err.message
            : "Failed to trigger accountability alert.",
      );
    } finally {
      setTriggering(false);
    }
  }

  async function sendPress() {
    if (!activeClusterId) return;
    try {
      const event = await api.sendPressDigest(activeClusterId);
      setPressEvent(event.response_summary);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to simulate press dispatch.",
      );
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        eyebrow="Accountability engine"
        title="What happens to ignored complaints?"
        description="A cluster escalates when it crosses the 50-report, 30-day unresolved threshold with no FIR or resolution status. All outputs are generated from the cluster's own fields — never invented."
        actions={
          <StatusBadge
            label={activeCluster?.is_accountability_alert ? "Alert active" : "Monitoring"}
            tone={activeCluster?.is_accountability_alert ? "emergency" : "muted"}
          />
        }
      />

      {error ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertTitle>Accountability engine</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {triggerMessage ? (
        <Alert>
          <Sparkles aria-hidden />
          <AlertTitle>Outputs generated</AlertTitle>
          <AlertDescription>{triggerMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Reports in active cluster"
          value={
            activeCluster
              ? activeCluster.report_count.toLocaleString("en-IN")
              : "—"
          }
          loading={loading}
        />
        <MetricCard
          label="Total reported"
          value={
            activeCluster
              ? `Rs ${Math.round(activeCluster.total_amount).toLocaleString("en-IN")}`
              : "—"
          }
          tone="primary"
          loading={loading}
        />
        <MetricCard
          label="States touched"
          value={activeCluster ? String(activeCluster.states.length) : "—"}
          loading={loading}
        />
        <MetricCard
          label="Window"
          value="30 days"
          hint="Unresolved"
          loading={loading}
        />
        <MetricCard
          label="FIR / resolution"
          value="None"
          tone="muted"
          hint="Verified absent"
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-0.5">
            <CardTitle>Escalation pipeline</CardTitle>
            <CardDescription>
              Five deterministic stages. The active cluster is highlighted in
              red.
            </CardDescription>
          </div>
          <StatusBadge
            label={`${PIPELINE_STAGES.length} stages`}
            tone="muted"
          />
        </CardHeader>
        <CardContent>
          <WorkflowStepper
            steps={PIPELINE_STAGES.map((s, idx) => {
              const isAlert = activeCluster?.is_accountability_alert ?? false;
              const activeIdx = isAlert
                ? PIPELINE_STAGES.length - 1
                : 1;
              return {
                id: s.key,
                label: s.label,
                state:
                  idx < activeIdx
                    ? ("done" as const)
                    : idx === activeIdx
                      ? ("active" as const)
                      : ("pending" as const),
              };
            })}
          />
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {PIPELINE_STAGES.map((stage, idx) => (
              <li
                key={stage.key}
                className="rounded-md border border-border bg-card p-2.5"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Stage {String(idx + 1).padStart(2, "0")}
                </p>
                <p className="text-xs font-semibold text-foreground">
                  {stage.label}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {stage.key === "intake" &&
                    "Anonymous reports enter the deterministic seed."}
                  {stage.key === "similarity" &&
                    "UPI, phone, handle, and URL match across reports."}
                  {stage.key === "cluster" &&
                    "Cluster crosses the 50-report, 30-day threshold."}
                  {stage.key === "alert" &&
                    "Public dashboard flag, no FIR, no resolution."}
                  {stage.key === "escalation" &&
                    "Press digest, RTI draft, infographic, victim note."}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-0.5">
              <CardTitle>Cluster monitor</CardTitle>
              <CardDescription>
                Pick a cluster to inspect or trigger
              </CardDescription>
            </div>
            <Badge variant="secondary" className="rounded-full">
              {clusters.length} cluster{clusters.length === 1 ? "" : "s"}
            </Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-16 w-full" />
                ))}
              </div>
            ) : clusters.length === 0 ? (
              <p className="text-sm text-muted-foreground">No clusters yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {clusters.map((cluster) => {
                  const isActive = cluster.id === activeClusterId;
                  return (
                    <li key={cluster.id}>
                      <button
                        type="button"
                        onClick={() => setActiveClusterId(cluster.id)}
                        aria-pressed={isActive}
                        className={cn(
                          "flex w-full flex-col gap-1.5 rounded-md border p-3 text-left text-sm transition-colors",
                          isActive
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card hover:bg-muted/30",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">
                            {FRAUD_LABEL[cluster.fraud_type] ?? cluster.fraud_type}
                          </span>
                          <span className="num text-xs text-muted-foreground">
                            {cluster.report_count} reports
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
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {!digest || !activeCluster ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cluster outputs</CardTitle>
                <CardDescription>
                  Pick a cluster to see its generated drafts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No cluster selected.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-0.5">
                  <CardTitle className="text-sm">
                    {FRAUD_LABEL[digest.cluster.fraud_type] ??
                      digest.cluster.fraud_type}
                  </CardTitle>
                  <CardDescription>
                    {digest.cluster.report_count} reports · Rs{" "}
                    {Math.round(
                      digest.cluster.total_amount,
                    ).toLocaleString("en-IN")}{" "}
                    total · {digest.cluster.states.length} states
                  </CardDescription>
                </div>
                <CardAction>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={triggerAlert}
                    disabled={
                      triggering ||
                      digest.cluster.is_accountability_alert ||
                      digest.cluster.report_count < 50
                    }
                  >
                    <Megaphone className="size-3.5" aria-hidden />
                    {digest.cluster.is_accountability_alert
                      ? "Alert already active"
                      : triggering
                        ? "Triggering…"
                        : "Trigger alert"}
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {pressEvent ? (
                  <Alert>
                    <CircleCheck aria-hidden />
                    <AlertTitle>Press dispatch (simulated)</AlertTitle>
                    <AlertDescription>{pressEvent}</AlertDescription>
                  </Alert>
                ) : null}
                <Tabs defaultValue="digest">
                  <TabsList>
                    <TabsTrigger value="digest">
                      <FileText className="size-3.5" aria-hidden /> Press
                    </TabsTrigger>
                    <TabsTrigger value="rti">
                      <ScrollText className="size-3.5" aria-hidden /> RTI
                    </TabsTrigger>
                    <TabsTrigger value="infographic">
                      <ImageIcon className="size-3.5" aria-hidden /> Infographic
                    </TabsTrigger>
                    <TabsTrigger value="victim">
                      <Mail className="size-3.5" aria-hidden /> Victim
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="digest">
                    <DocumentPanel
                      title={digest.digest.title}
                      body={digest.digest.editable_body}
                      kind="Press"
                    />
                  </TabsContent>
                  <TabsContent value="rti">
                    <DocumentPanel
                      title={digest.rti_draft.title}
                      body={digest.rti_draft.editable_body}
                      kind="RTI"
                    />
                  </TabsContent>
                  <TabsContent value="infographic">
                    <DocumentPanel
                      title={digest.infographic.title}
                      body={digest.infographic.editable_body}
                      kind="Infographic"
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
                      kind="Notification"
                    />
                  </TabsContent>
                </Tabs>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={sendPress}>
                    <Send className="size-3.5" aria-hidden />
                    Simulate press dispatch
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboards/journalist">
                      <Compass className="size-3.5" aria-hidden />
                      Open in journalist view
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <IdentifiersCard cluster={activeCluster} />
            <StoryLeadCard digest={digest} />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-0.5">
            <CardTitle>Mock integration event log</CardTitle>
            <CardDescription>
              Every row is generated from the cluster&apos;s own fields.
              Press &quot;Simulate press dispatch&quot; to append the final
              event.
            </CardDescription>
          </div>
          <StatusBadge
            label={`${mockEventLog.length} event${mockEventLog.length === 1 ? "" : "s"}`}
            tone="muted"
          />
        </CardHeader>
        <CardContent>
          <MockIntegrationLog
            events={mockEventLog.map((event) => ({
              id: `${event.adapter}-${event.operation}-${event.step}`,
              title: event.step,
              body: `${event.operation} · ${event.response_summary}`,
              tone:
                event.status === "simulated_success"
                  ? ("ok" as const)
                  : event.status === "simulated_pending"
                    ? ("pending" as const)
                    : ("alert" as const),
            }))}
          />
        </CardContent>
      </Card>

      <PrivacyNotice title="Disclosure rules">
        RTI drafts are addressed to the relevant state cyber crime cell
        using public authorities. Press digests use only cluster-level
        counts. CyberSaathi never includes victim identities, full phone
        numbers, or unredacted bank details in any public output.
      </PrivacyNotice>
    </div>
  );
}

function DocumentPanel({
  title,
  body,
  kind,
}: {
  title: string;
  body: string;
  kind: "Press" | "RTI" | "Infographic" | "Notification";
}) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <header className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <StatusBadge label={kind} tone="saffron" />
      </header>
      <ScrollArea className="max-h-72">
        <pre className="whitespace-pre-wrap font-sans text-xs text-foreground">
          {body}
        </pre>
      </ScrollArea>
    </div>
  );
}

function IdentifiersCard({ cluster }: { cluster: ClusterSummary | null }) {
  if (!cluster) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Anonymised common identifiers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No cluster selected.</p>
        </CardContent>
      </Card>
    );
  }
  const items = cluster.common_identifier_summary ?? [];
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-sm">
            Anonymised common identifiers
          </CardTitle>
          <CardDescription>Shared across the cluster</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No shared identifiers.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {items.slice(0, 3).map((line, idx) => (
              <li
                key={idx}
                className="rounded-md border border-border bg-muted/30 px-2 py-1.5 font-mono text-xs text-foreground"
              >
                {line}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function StoryLeadCard({
  digest,
}: {
  digest: JournalistDigest | null;
}) {
  if (!digest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Journalist story lead</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No cluster selected.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-sm">Journalist story lead</CardTitle>
          <CardDescription>First six lines of the press digest</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-semibold text-foreground">
          {digest.digest.title}
        </p>
        <p className="mt-1 line-clamp-5 whitespace-pre-wrap text-xs text-muted-foreground">
          {digest.digest.editable_body.split("\n").slice(0, 6).join("\n")}
        </p>
      </CardContent>
    </Card>
  );
}

type MockEvent = Pick<
  MockIntegrationEvent,
  "adapter" | "operation" | "request_summary" | "response_summary" | "status"
> & { step: string };

function buildMockEventLog(
  cluster: ClusterSummary | null,
  digest: JournalistDigest | null,
  pressEventResponse: string | null,
): MockEvent[] {
  if (!cluster) return [];
  const events: MockEvent[] = [];
  events.push({
    step: "1. Similarity match",
    adapter: "similarity_engine",
    operation: "match_against_seed",
    request_summary: `cluster=${cluster.id} identifiers=${cluster.common_identifier_summary.length}`,
    response_summary: `${cluster.report_count} reports share identifiers in seed data.`,
    status: "simulated_success",
  });
  events.push({
    step: "2. Cluster threshold",
    adapter: "cluster_monitor",
    operation: "evaluate_threshold",
    request_summary: "min_reports=50 window_days=30",
    response_summary:
      cluster.report_count >= 50
        ? `Threshold crossed (${cluster.report_count} ≥ 50).`
        : `Below threshold (${cluster.report_count} < 50).`,
    status: cluster.is_accountability_alert
      ? "simulated_success"
      : "simulated_pending",
  });
  events.push({
    step: "3. FIR / resolution check",
    adapter: "police_adapter",
    operation: "mock_check_fir",
    request_summary: "fir_or_resolution_required=false",
    response_summary: cluster.is_accountability_alert
      ? "No mock FIR and no resolution on record."
      : "Cluster has FIR or resolution on record — not escalated.",
    status: cluster.is_accountability_alert
      ? "simulated_success"
      : "simulated_pending",
  });
  if (cluster.is_accountability_alert) {
    events.push({
      step: "4. Public alert flag",
      adapter: "public_dashboard",
      operation: "flag_accountability_alert",
      request_summary: `cluster=${cluster.id}`,
      response_summary: "Alert visible on the public dashboard.",
      status: "simulated_success",
    });
  }
  if (cluster.is_accountability_alert && digest) {
    events.push({
      step: "5. Journalist digest",
      adapter: "journalist_adapter",
      operation: "generate_digest",
      request_summary: `cluster=${cluster.id}`,
      response_summary: digest.digest.title,
      status: "simulated_success",
    });
    events.push({
      step: "6. RTI draft",
      adapter: "rti_adapter",
      operation: "generate_rti_draft",
      request_summary: `cluster=${cluster.id}`,
      response_summary: digest.rti_draft.title,
      status: "simulated_success",
    });
    events.push({
      step: "7. Infographic copy",
      adapter: "journalist_adapter",
      operation: "generate_infographic",
      request_summary: `cluster=${cluster.id}`,
      response_summary: digest.infographic.title,
      status: "simulated_success",
    });
    if (digest.victim_notification) {
      events.push({
        step: "8. Victim notification",
        adapter: "victim_notifier",
        operation: "generate_victim_note",
        request_summary: `cluster=${cluster.id}`,
        response_summary: digest.victim_notification.title,
        status: "simulated_success",
      });
    }
  }
  if (pressEventResponse) {
    events.push({
      step: "9. Press dispatch (simulated)",
      adapter: "press_adapter",
      operation: "send_press_digest",
      request_summary: `cluster=${cluster.id}`,
      response_summary: pressEventResponse,
      status: "simulated_success",
    });
  }
  return events;
}
