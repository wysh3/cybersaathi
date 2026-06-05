"use client";

/**
 * CyberSaathi Judge Demo — 90-second guided walkthrough.
 *
 * Six steps from panic to public pressure. Each step shows real numbers
 * from the deterministic seed data, and the buttons deep-link into the
 * working product. The desktop layout is a sticky progress rail + main
 * column; mobile shows the rail as a horizontal stepper above the
 * first step.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Compass,
  FileText,
  Lightbulb,
  ListChecks,
  Mail,
  Map as MapIcon,
  Megaphone,
  Receipt,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  WandSparkles,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

import { CaseSummaryCard } from "@/components/app/CaseSummaryCard";
import { MetricCard } from "@/components/app/MetricCard";
import { PageHeader } from "@/components/app/PageHeader";
import { PrivacyNotice } from "@/components/app/PrivacyNotice";
import { WorkflowStepper } from "@/components/app/WorkflowStepper";

import { api } from "@/lib/api";
import type { ClusterSummary, PublicDashboard } from "@/lib/types";

const STEPS: ReadonlyArray<{
  id: string;
  num: string;
  title: string;
  blurb: string;
  cta: { href: string; label: string };
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}> = [
  {
    id: "intake",
    num: "01",
    title: "Panic input",
    blurb:
      "A hostel student in Delhi loses Rs 2,500 on Google Pay to a fake 'warden'. She types one short sentence. CyberSaathi detects the fraud, language, payment app, amount, and time-since-incident — in under a second.",
    cta: { href: "/", label: "Run the intake" },
    icon: Receipt,
  },
  {
    id: "golden_hour",
    num: "02",
    title: "Golden Hour intervention",
    blurb:
      "Because the loss happened 15 minutes ago, the system routes to Golden Hour. A red emergency cockpit takes over: one dominant 'Call 1930 Now' button, a 60-minute countdown, a prepared case brief, and a bilingual call script.",
    cta: { href: "/emergency", label: "Open Golden Hour" },
    icon: Sparkles,
  },
  {
    id: "documents",
    num: "03",
    title: "Complaint package",
    blurb:
      "After the helpline reference is captured, CyberSaathi generates four editable drafts — NCRP complaint, bank dispute email, evidence timeline, and recovery checklist — using only the redacted, anonymised facts.",
    cta: { href: "/documents", label: "See the package" },
    icon: FileText,
  },
  {
    id: "similarity",
    num: "04",
    title: "Scam similarity",
    blurb:
      "The UPI ID, phone number, or message-template hash is matched against the deterministic seed. The victim sees how many other reports share the same identifier — proof that this is not an isolated case.",
    cta: { href: "/dashboards/journalist", label: "View journalist dashboard" },
    icon: ListChecks,
  },
  {
    id: "heatmap",
    num: "05",
    title: "India heatmap intelligence",
    blurb:
      "Across India, anonymised complaint counts are visualised on a real geographic choropleth. Click any state to see the district rollup, top fraud type, and accountability-alert status.",
    cta: { href: "/dashboards/heatmap", label: "Open the heatmap" },
    icon: MapIcon,
  },
  {
    id: "accountability",
    num: "06",
    title: "Accountability escalation",
    blurb:
      "When 50+ matching reports cross the 30-day unresolved window with no FIR, the cluster escalates. A public alert, journalist digest, RTI draft, infographic copy, and a victim notification are generated from the cluster's own fields — no invented stats.",
    cta: { href: "/accountability", label: "Open accountability engine" },
    icon: Megaphone,
  },
];

export function JudgeDemo() {
  const [active, setActive] = useState<string>(STEPS[0].id);
  const [dash, setDash] = useState<PublicDashboard | null>(null);
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [alerts, setAlerts] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activeEffect = true;
    void Promise.all([api.publicDashboard(), api.listClusters()])
      .then(([d, c]) => {
        if (!activeEffect) return;
        setDash(d);
        setClusters(c.clusters);
        setAlerts(c.accountability_alert_count);
        setLoading(false);
      })
      .catch(() => {
        if (activeEffect) setLoading(false);
      });
    return () => {
      activeEffect = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => {
      const offsets = STEPS.map((step) => {
        const el = document.getElementById(`demo-${step.id}`);
        if (!el) return { id: step.id, top: Number.POSITIVE_INFINITY };
        const rect = el.getBoundingClientRect();
        return { id: step.id, top: Math.abs(rect.top - 120) };
      });
      const nearest = offsets.reduce((a, b) => (a.top < b.top ? a : b));
      setActive(nearest.id);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const primaryCluster = useMemo(
    () => clusters.find((c) => c.is_accountability_alert) ?? clusters[0] ?? null,
    [clusters],
  );

  const activeIndex = STEPS.findIndex((s) => s.id === active);
  const progressPct = Math.round(((activeIndex + 1) / STEPS.length) * 100);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start" aria-label="Demo progress">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-0.5">
              <CardTitle className="text-sm">90-second demo</CardTitle>
              <CardDescription>Six steps from panic to public pressure</CardDescription>
            </div>
            <WandSparkles className="size-4 text-primary" aria-hidden />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Progress value={progressPct} className="h-1.5" aria-label="Demo progress" />
            <WorkflowStepper
              steps={STEPS.map((s, idx) => ({
                id: s.id,
                label: s.num,
                state:
                  idx < activeIndex
                    ? ("done" as const)
                    : idx === activeIndex
                      ? ("active" as const)
                      : ("pending" as const),
              }))}
            />
            <ol className="flex flex-col gap-1.5">
              {STEPS.map((step) => {
                const Icon = step.icon;
                const isActive = active === step.id;
                return (
                  <li key={step.id}>
                    <a
                      href={`#demo-${step.id}`}
                      aria-current={isActive ? "true" : undefined}
                      className={
                        "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors " +
                        (isActive
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/30")
                      }
                    >
                      <Icon className="size-3.5" aria-hidden />
                      <span className="font-mono text-[11px] font-semibold tabular-nums">
                        {step.num}
                      </span>
                      <span className="font-semibold">{step.title}</span>
                    </a>
                  </li>
                );
              })}
            </ol>
            <div className="mt-2 flex flex-col gap-1.5">
              <Button asChild size="sm">
                <Link href="/">
                  <Sparkles className="size-3.5" aria-hidden /> Start Priya demo
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboards/heatmap">
                  Open heatmap
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/accountability">
                  Open accountability engine
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </aside>

      <main className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Judge demo · 90 seconds"
          title="From panic to public pressure, in six steps"
          description="A guided walkthrough of CyberSaathi's victim-state engine. Every number on this page is computed from the same deterministic seed data the live product uses — no invented stats."
        />

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Reports in seed"
              value={
                dash
                  ? dash.total_complaints.toLocaleString("en-IN")
                  : "—"
              }
              icon={Receipt}
            />
            <MetricCard
              label="Total reported"
              value={
                dash
                  ? `Rs ${Math.round(dash.total_reported_amount).toLocaleString("en-IN")}`
                  : "—"
              }
              tone="primary"
              icon={Lightbulb}
            />
            <MetricCard
              label="Accountability alerts"
              value={alerts != null ? String(alerts) : "—"}
              tone="emergency"
              icon={Megaphone}
            />
            <MetricCard
              label="Tracked clusters"
              value={String(clusters.length)}
              icon={Compass}
            />
          </div>
        )}

        <DemoStep
          id="intake"
          num="01"
          title="Panic input"
          icon={Receipt}
        >
          <p>
            A hostel student in Delhi loses Rs 2,500 on Google Pay to a
            fake &apos;warden&apos;. She types one short sentence. CyberSaathi
            detects the fraud, language, payment app, amount, and
            time-since-incident — in under a second.
          </p>
          <PipelineDiagram
            steps={[
              { label: "Description", icon: Receipt },
              { label: "Redaction", icon: ShieldCheck },
              { label: "Extraction", icon: Compass },
              { label: "Routing", icon: Sparkles },
            ]}
          />
          <StepCta href="/" label="Run the intake" />
        </DemoStep>

        <DemoStep
          id="golden_hour"
          num="02"
          title="Golden Hour intervention"
          icon={Sparkles}
        >
          <p>
            Because the loss happened 15 minutes ago, the system routes
            to Golden Hour. A red emergency cockpit takes over: one
            dominant &apos;Call 1930 Now&apos; button, a 60-minute countdown, a
            prepared case brief, and a bilingual call script.
          </p>
          <Alert variant="destructive">
            <TriangleAlert aria-hidden />
            <AlertTitle>Reporting quickly may improve fund-blocking chances</AlertTitle>
            <AlertDescription>
              We do not promise recovery. We prepare the call.
            </AlertDescription>
          </Alert>
          <CaseSummaryCard
            facts={[
              { label: "Amount", value: "Rs 2,500", highlight: true },
              { label: "UPI ID", value: "scammer.fraud@upi", mono: true },
              { label: "Time since incident", value: "15 min" },
            ]}
            columns={3}
          />
          <StepCta href="/emergency" label="Open Golden Hour" />
        </DemoStep>

        <DemoStep
          id="documents"
          num="03"
          title="Complaint package"
          icon={FileText}
        >
          <p>
            After the helpline reference is captured, CyberSaathi
            generates four editable drafts — NCRP complaint, bank dispute
            email, evidence timeline, and recovery checklist — using only
            the redacted, anonymised facts.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <DocCard icon={FileText} title="NCRP complaint draft" />
            <DocCard icon={Mail} title="Bank dispute email" />
            <DocCard icon={ListChecks} title="Evidence timeline" />
            <DocCard icon={CheckCircle} title="Recovery checklist" />
          </div>
          <Alert>
            <ShieldCheck aria-hidden />
            <AlertTitle>Editable drafts only</AlertTitle>
            <AlertDescription>
              CyberSaathi files nothing on the victim&apos;s behalf. Final
              submission happens on the official NCRP portal.
            </AlertDescription>
          </Alert>
          <StepCta href="/documents" label="See the package" />
        </DemoStep>

        <DemoStep
          id="similarity"
          num="04"
          title="Scam similarity"
          icon={ListChecks}
        >
          <p>
            The UPI ID, phone number, or message-template hash is matched
            against the deterministic seed. The victim sees how many
            other reports share the same identifier — proof that this is
            not an isolated case.
          </p>
          <Alert>
            <ListChecks aria-hidden />
            <AlertTitle>&quot;32 other reports in the demo data mention this UPI ID.&quot;</AlertTitle>
            <AlertDescription>
              Counts are computed from the seed — never invented.
            </AlertDescription>
          </Alert>
          <StepCta
            href="/dashboards/journalist"
            label="View journalist dashboard"
          />
        </DemoStep>

        <DemoStep
          id="heatmap"
          num="05"
          title="India heatmap intelligence"
          icon={MapIcon}
        >
          <p>
            Across India, anonymised complaint counts are visualised on a
            real geographic choropleth. Click any state to see the
            district rollup, top fraud type, and accountability-alert
            status.
          </p>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                label="Reports in seed"
                value={
                  dash
                    ? dash.total_complaints.toLocaleString("en-IN")
                    : "—"
                }
              />
              <MetricCard
                label="Total reported"
                value={
                  dash
                    ? `Rs ${Math.round(dash.total_reported_amount).toLocaleString("en-IN")}`
                    : "—"
                }
                tone="primary"
              />
              <MetricCard
                label="Alert states"
                value={dash ? String(dash.accountability_alerts.length) : "—"}
                tone="emergency"
              />
            </div>
          )}
          <Alert>
            <MapIcon aria-hidden />
            <AlertTitle>Vendored map geometry</AlertTitle>
            <AlertDescription>
              Map data is vendored locally from{" "}
              <code className="rounded bg-muted px-1 font-mono text-[11px]">
                udit-001/india-maps-data
              </code>
              . No runtime network fetch.
            </AlertDescription>
          </Alert>
          <StepCta href="/dashboards/heatmap" label="Open the heatmap" />
        </DemoStep>

        <DemoStep
          id="accountability"
          num="06"
          title="Accountability escalation"
          icon={Megaphone}
        >
          <p>
            When 50+ matching reports cross the 30-day unresolved window
            with no FIR, the cluster escalates. A public alert,
            journalist digest, RTI draft, infographic copy, and a victim
            notification are generated from the cluster&apos;s own fields — no
            invented stats.
          </p>
          {primaryCluster ? (
            <Alert variant="destructive">
              <Megaphone aria-hidden />
              <AlertTitle>
                Active cluster: {primaryCluster.fraud_type.replace(/_/g, " ")} ·{" "}
                {primaryCluster.report_count} reports
              </AlertTitle>
              <AlertDescription>
                Rs{" "}
                {Math.round(primaryCluster.total_amount).toLocaleString(
                  "en-IN",
                )}{" "}
                total · {primaryCluster.states.length} states ·{" "}
                {primaryCluster.districts.length} districts
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <FactCell label="Press digest" value="Ready" small />
            <FactCell label="RTI draft" value="Ready" small />
            <FactCell label="Infographic" value="Ready" small />
            <FactCell label="Victim note" value="Ready" small />
          </div>
          <Alert>
            <ShieldCheck aria-hidden />
            <AlertTitle>Public outputs are anonymised</AlertTitle>
            <AlertDescription>
              We never include victim identities, full phone numbers,
              Aadhaar, PAN, OTP, or full card numbers.
            </AlertDescription>
          </Alert>
          <StepCta
            href="/accountability"
            label="Open accountability engine"
          />
        </DemoStep>

        <PrivacyNotice title="Demo integrity">
          CyberSaathi never calls 1930, NCRP, banks, WhatsApp, or RTI on
          the victim&apos;s behalf. The MVP uses deterministic mock adapters
          for all official integrations. All numbers in this demo come
          from a versioned seed data set.
        </PrivacyNotice>
      </main>
    </div>
  );
}

function DemoStep({
  id,
  num,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  num: string;
  title: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`demo-${id}`}
      className="scroll-mt-24"
      aria-labelledby={`demo-${id}-title`}
    >
      <Card>
        <CardHeader>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-2xl font-semibold tabular-nums text-primary">
              {num}
            </span>
            <CardTitle id={`demo-${id}-title`} className="text-lg sm:text-xl">
              <span className="inline-flex items-center gap-2">
                <Icon className="size-4 text-primary" aria-hidden />
                {title}
              </span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-foreground">
          {children}
        </CardContent>
      </Card>
    </section>
  );
}

function StepCta({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild className="self-start">
      <Link href={href}>
        {label}
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </Button>
  );
}

function FactCell({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={
          small
            ? "text-xs font-semibold text-foreground"
            : "text-sm font-semibold text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}

function DocCard({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card p-3">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="text-sm font-semibold text-foreground">{title}</span>
    </div>
  );
}

function PipelineDiagram({
  steps,
}: {
  steps: ReadonlyArray<{
    label: string;
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  }>;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Deterministic intelligence pipeline
      </p>
      <ol className="flex flex-wrap items-center gap-2">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <li key={step.label} className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-card px-2.5 py-1 text-xs font-semibold text-foreground">
                <Icon className="size-3 text-primary" aria-hidden />
                {step.label}
              </span>
              {idx < steps.length - 1 ? (
                <ArrowRight
                  className="size-3 text-muted-foreground"
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
