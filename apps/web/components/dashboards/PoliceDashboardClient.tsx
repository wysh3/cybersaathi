"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  ChevronRight,
  ExternalLink,
  Filter,
  MapPinned,
  TriangleAlert,
  X,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { MetricCard } from "@/components/app/MetricCard";
import { PrivacyNotice } from "@/components/app/PrivacyNotice";

import { api, ApiError } from "@/lib/api";
import type { ClusterSummary } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PoliceRow {
  state: string;
  district: string;
  fraud_type: string;
  count: number;
}

interface PoliceData {
  total_complaints: number;
  total_amount: number;
  rows: PoliceRow[];
  note: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FRAUD_LABEL: Record<string, string> = {
  personal_safety_extortion: "Personal safety & extortion",
  money_movement_fraud: "Money movement fraud",
  device_data_compromise: "Device & data compromise",
  identity_account_control: "Identity & account control",
  platform_content_suspect: "Platform & suspect content",
};

const FRAUD_ADVISORY: Record<string, string> = {
  personal_safety_extortion:
    "Handle with sensitivity and no victim-blaming language. Preserve evidence without sharing. Guide the victim to block the offender, avoid further payments, and escalate immediate threats through emergency support.",
  money_movement_fraud:
    "Cross-check payment handles, account details, UTRs, and transaction IDs. Coordinate with local cyber cell and relevant bank/payment provider for freezing or dispute steps. Request a 1930 helpline reference number if not already captured.",
  device_data_compromise:
    "Record affected devices, remote-access apps, malware indicators, locked files, and breach timing. Advise isolation from the network and preserve logs/screenshots before cleanup.",
  identity_account_control:
    "Verify compromised account, SIM, KYC, email, or credential details. Guide recovery and password reset steps, collect login-attempt evidence, and check for linked financial loss.",
  platform_content_suspect:
    "Collect the profile, URL, app, sender, message template, or suspicious content. Preserve screenshots and platform identifiers for takedown or blocking review.",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PoliceDashboardClient() {
  /* ---- data ---- */
  const [data, setData] = useState<PoliceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [clustersLoading, setClustersLoading] = useState(true);

  /* ---- filter state ---- */
  const [stateFilter, setStateFilter] = useState("__all__");
  const [districtFilter, setDistrictFilter] = useState("__all__");
  const [fraudTypeFilter, setFraudTypeFilter] = useState("__all__");

  /* ---- drilldown state ---- */
  const [selectedRow, setSelectedRow] = useState<PoliceRow | null>(null);

  /* ---- fetch ---- */
  useEffect(() => {
    let active = true;
    void (() => {
      setLoading(true);
      setError(null);
    })();
    api
      .policeDashboard()
      .then((response: unknown) => {
        if (!active) return;
        setData(response as PoliceData);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof ApiError
            ? `${err.message}: ${JSON.stringify(err.detail)}`
            : err instanceof Error
              ? err.message
              : "Failed to load police dashboard.",
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (() => {
      setClustersLoading(true);
    })();
    api
      .listClusters()
      .then((response) => {
        if (!active) return;
        setClusters(response.clusters);
        setClustersLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setClusters([]);
        setClustersLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  /* ---- derived lists ---- */
  const states = useMemo(
    () =>
      Array.from(new Set((data?.rows ?? []).map((r) => r.state))).sort(),
    [data?.rows],
  );

  const districts = useMemo(
    () =>
      Array.from(
        new Set(
          (data?.rows ?? [])
            .filter((r) => stateFilter === "__all__" || r.state === stateFilter)
            .map((r) => r.district),
        ),
      ).sort(),
    [data?.rows, stateFilter],
  );

  const fraudTypes = useMemo(
    () =>
      Array.from(new Set((data?.rows ?? []).map((r) => r.fraud_type))).sort(),
    [data?.rows],
  );

  /* ---- filtered ---- */
  const filtered = useMemo(() => {
    return (data?.rows ?? []).filter(
      (r) =>
        (stateFilter === "__all__" || r.state === stateFilter) &&
        (districtFilter === "__all__" || r.district === districtFilter) &&
        (fraudTypeFilter === "__all__" || r.fraud_type === fraudTypeFilter),
    );
  }, [data?.rows, stateFilter, districtFilter, fraudTypeFilter]);

  const filteredCount = useMemo(
    () => filtered.reduce((a, r) => a + r.count, 0),
    [filtered],
  );

  const totalFiltered = filteredCount;

  /* ---- top fraud type metric ---- */
  const topFraudType = useMemo(() => {
    const ftCounts: Record<string, number> = {};
    for (const r of filtered) {
      ftCounts[r.fraud_type] = (ftCounts[r.fraud_type] || 0) + r.count;
    }
    const sorted = Object.entries(ftCounts).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return null;
    const total = sorted.reduce((s, [, c]) => s + c, 0);
    return {
      type: sorted[0][0],
      label: FRAUD_LABEL[sorted[0][0]] ?? sorted[0][0],
      count: sorted[0][1],
      pct: Math.round((sorted[0][1] / total) * 100),
    };
  }, [filtered]);

  /* ---- top patterns (top 5 fraud types for the pattern card) ---- */
  const patterns = useMemo(() => {
    const ftCounts: Record<string, number> = {};
    for (const r of filtered) {
      ftCounts[r.fraud_type] = (ftCounts[r.fraud_type] || 0) + r.count;
    }
    return Object.entries(ftCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({
        type,
        label: FRAUD_LABEL[type] ?? type,
        count,
        pct:
          totalFiltered > 0 ? Math.round((count / totalFiltered) * 100) : 0,
      }));
  }, [filtered, totalFiltered]);

  /* ---- matching clusters for drilldown ---- */
  const matchingClusters = useMemo(() => {
    if (!selectedRow) return [];
    return clusters.filter((c) => {
      const fraudMatch = c.fraud_type === selectedRow.fraud_type;
      const districtMatch = c.districts.includes(selectedRow.district);
      const stateMatch = c.states.includes(selectedRow.state);
      return fraudMatch && (districtMatch || stateMatch);
    });
  }, [clusters, selectedRow]);

  /* ---- active filter pills ---- */
  const activeFilters: Array<{
    key: string;
    label: string;
    onClear: () => void;
  }> = [];
  if (stateFilter !== "__all__") {
    activeFilters.push({
      key: "state",
      label: `State: ${stateFilter}`,
      onClear: () => {
        setStateFilter("__all__");
        setDistrictFilter("__all__");
      },
    });
  }
  if (districtFilter !== "__all__") {
    activeFilters.push({
      key: "district",
      label: `District: ${districtFilter}`,
      onClear: () => setDistrictFilter("__all__"),
    });
  }
  if (fraudTypeFilter !== "__all__") {
    activeFilters.push({
      key: "fraudType",
      label: `Type: ${FRAUD_LABEL[fraudTypeFilter] ?? fraudTypeFilter}`,
      onClear: () => setFraudTypeFilter("__all__"),
    });
  }

  /* ---- reset ---- */
  const clearFilters = () => {
    setStateFilter("__all__");
    setDistrictFilter("__all__");
    setFraudTypeFilter("__all__");
  };

  const isFiltered = activeFilters.length > 0;

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* ---- header ---- */}
      <PageHeader
        eyebrow="Police demo"
        title="Jurisdictional view"
        description="Aggregated counts and trends by state, district, and fraud type. No victim identities, no raw evidence. Click any row for an anonymised cluster drilldown."
      />

      {/* ---- error ---- */}
      {error ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertTitle>Police dashboard</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* ---- metric cards ---- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total reports (seed)"
          value={
            data ? data.total_complaints.toLocaleString("en-IN") : "\u2014"
          }
          hint="Across entire seed dataset"
          icon={MapPinned}
          loading={loading}
        />
        <MetricCard
          label="Total reported"
          value={
            data
              ? `Rs ${Math.round(data.total_amount).toLocaleString("en-IN")}`
              : "\u2014"
          }
          hint="Self-reported loss"
          tone="primary"
          loading={loading}
        />
        <MetricCard
          label="Filtered reports"
          value={filteredCount.toLocaleString("en-IN")}
          hint="Current jurisdiction + type filter"
          icon={Filter}
          loading={loading}
        />
        <MetricCard
          label={topFraudType ? topFraudType.label : "Top fraud type"}
          value={
            topFraudType
              ? `${topFraudType.count.toLocaleString("en-IN")} (${topFraudType.pct}%)`
              : "\u2014"
          }
          hint={topFraudType ? "Dominant type in current filter" : "No data"}
          tone={topFraudType ? "primary" : "muted"}
          loading={loading}
        />
      </div>

      {/* ---- filter pills ---- */}
      {isFiltered ? (
        <div className="flex flex-wrap items-center gap-2" role="list" aria-label="Active filters">
          {activeFilters.map((f) => (
            <Badge
              key={f.key}
              variant="secondary"
              className="gap-1 pr-1"
              role="listitem"
            >
              {f.label}
              <button
                type="button"
                onClick={f.onClear}
                className="-mr-0.5 ml-0.5 inline-flex size-4 items-center justify-center rounded-full hover:bg-muted-foreground/20"
                aria-label={`Remove ${f.label} filter`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-6 text-xs text-muted-foreground"
          >
            Clear all
          </Button>
        </div>
      ) : null}

      {/* ---- filter controls ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by jurisdiction and type</CardTitle>
          <CardDescription>
            State, district, and fraud type. All filters are optional.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            {/* state */}
            <div className="flex min-w-[200px] flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                State
              </span>
              <Select
                value={stateFilter}
                onValueChange={(v) => {
                  setStateFilter(v);
                  setDistrictFilter("__all__");
                }}
              >
                <SelectTrigger aria-label="Filter by state">
                  <SelectValue placeholder="All states" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All states</SelectItem>
                  {states.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* district */}
            <div className="flex min-w-[200px] flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                District
              </span>
              <Select
                value={districtFilter}
                onValueChange={(v) => setDistrictFilter(v)}
                disabled={stateFilter === "__all__"}
              >
                <SelectTrigger aria-label="Filter by district">
                  <SelectValue placeholder="All districts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All districts</SelectItem>
                  {districts.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* fraud type */}
            <div className="flex min-w-[200px] flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Fraud type
              </span>
              <Select
                value={fraudTypeFilter}
                onValueChange={(v) => setFraudTypeFilter(v)}
              >
                <SelectTrigger aria-label="Filter by fraud type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All types</SelectItem>
                  {fraudTypes.map((ft) => (
                    <SelectItem key={ft} value={ft}>
                      {FRAUD_LABEL[ft] ?? ft}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* clear */}
            {isFiltered ? (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="mb-px"
              >
                <Filter className="mr-1.5 size-3.5" />
                Clear filters
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* ---- top patterns ---- */}
      {!loading && filtered.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Top patterns in current filter</CardTitle>
            <CardDescription>
              Dominant fraud types by report count
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {patterns.map((p, idx) => (
                <div
                  key={p.type}
                  className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{p.label}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="num">{p.count.toLocaleString("en-IN")} reports</span>
                      <Separator orientation="vertical" className="h-3" />
                      <span>{p.pct}% of filtered volume</span>
                    </div>
                  </div>
                  <div
                    className="h-2 min-w-[60px] rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={p.pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${p.label} ${p.pct}%`}
                  >
                    <div
                      className="h-full rounded-full bg-primary/60 transition-all"
                      style={{ width: `${p.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ---- table ---- */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-0.5">
            <CardTitle>Complaint rows by jurisdiction</CardTitle>
            <CardDescription>
              {loading
                ? "Loading\u2026"
                : filtered.length > 30
                  ? `Showing 30 of ${filtered.length} rows (${filteredCount.toLocaleString("en-IN")} total reports)`
                  : `${filtered.length} row${filtered.length === 1 ? "" : "s"} (${filteredCount.toLocaleString("en-IN")} reports)`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Skeleton key={idx} className="h-9 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No rows for the current filter"
              description="Try clearing the state, district, or fraud type filter to see the broader picture."
              icon={Filter}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>District</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Fraud type</TableHead>
                  <TableHead className="text-right">Reports</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 30).map((row, idx) => (
                  <TableRow
                    key={`${row.state}-${row.district}-${row.fraud_type}-${idx}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open cluster details for ${row.district}, ${row.state} \u2014 ${FRAUD_LABEL[row.fraud_type] ?? row.fraud_type}`}
                    onClick={() => setSelectedRow(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedRow(row);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-semibold text-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <ChevronRight
                          className="size-3.5 text-muted-foreground"
                          aria-hidden
                        />
                        {row.district}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.state}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {FRAUD_LABEL[row.fraud_type] ?? row.fraud_type}
                    </TableCell>
                    <TableCell className="num text-right font-semibold text-foreground">
                      {row.count}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <ArrowUpDown className="ml-auto size-3.5" aria-hidden />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ---- drilldown dialog ---- */}
      <Dialog
        open={!!selectedRow}
        onOpenChange={(open) => {
          if (!open) setSelectedRow(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRow?.district}, {selectedRow?.state}
            </DialogTitle>
            <DialogDescription>
              {FRAUD_LABEL[selectedRow?.fraud_type ?? ""] ??
                selectedRow?.fraud_type}
              {" \u2014 "}
              {(selectedRow?.count ?? 0).toLocaleString("en-IN")} report
              {(selectedRow?.count ?? 0) === 1 ? "" : "s"} in seed data
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/* ---- quick stats ---- */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-background p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Reports
                </div>
                <div className="num mt-0.5 text-lg font-bold">
                  {(selectedRow?.count ?? 0).toLocaleString("en-IN")}
                </div>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Share of filtered
                </div>
                <div className="num mt-0.5 text-lg font-bold">
                  {totalFiltered > 0 && selectedRow
                    ? `${Math.round((selectedRow.count / totalFiltered) * 100)}%`
                    : "\u2014"}
                </div>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  State
                </div>
                <div className="mt-0.5 text-lg font-bold">
                  {selectedRow?.state ?? "\u2014"}
                </div>
              </div>
            </div>

            {/* ---- advisory ---- */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Police advisory
              </div>
              <p className="mt-1 text-sm leading-relaxed text-foreground">
                {selectedRow
                  ? FRAUD_ADVISORY[selectedRow.fraud_type] ??
                    FRAUD_ADVISORY.other
                  : ""}
              </p>
            </div>

            {/* ---- matching clusters ---- */}
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Matching clusters in seed
              </div>
              {clustersLoading ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : matchingClusters.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No clusters match this fraud type and location. This pattern
                  may be isolated or below the cluster detection threshold.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {matchingClusters.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-lg border bg-background px-3 py-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {FRAUD_LABEL[c.fraud_type] ?? c.fraud_type}{" "}
                          <Badge
                            variant={
                              c.status === "escalated" ||
                              c.is_accountability_alert
                                ? "destructive"
                                : "secondary"
                            }
                            className="ml-1.5 text-[10px]"
                          >
                            {c.status}
                          </Badge>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {c.report_count} report
                          {c.report_count === 1 ? "" : "s"} across{" "}
                          {c.districts.length} district
                          {c.districts.length === 1 ? "" : "s"}
                          {" \u2014 Rs "}
                          {Math.round(c.total_amount).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        asChild
                        aria-label={`View cluster ${c.id}`}
                      >
                        <a href={`/accountability?cluster=${c.id}`}>
                          <ExternalLink className="size-4" />
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ---- identifiers ---- */}
            {(() => {
              const rawSummaries = matchingClusters
                .flatMap((c) => c.common_identifier_summary)
                .filter(
                  (s): s is string => typeof s === "string" && s.length > 0,
                );
              const redacted = rawSummaries.filter(
                (s) => !/^[0-9a-f]{12,}$/i.test(s) && !s.startsWith("identifier:"),
              );
              const hasRawOnly = redacted.length === 0 && rawSummaries.length > 0;
              if (redacted.length > 0) {
                return (
                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Common identifiers (redacted)
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {redacted.slice(0, 5).map((id, idx) => (
                        <div
                          key={idx}
                          className="rounded-md border bg-background px-2.5 py-1.5 text-sm font-mono text-muted-foreground"
                        >
                          {id}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              if (hasRawOnly) {
                return (
                  <p className="text-xs text-muted-foreground">
                    Redacted identifier details are available on the cluster
                    detail page.
                  </p>
                );
              }
              return null;
            })()}
          </div>

          {/* ---- footer ---- */}
          <div className="-mx-4 -mb-4 flex flex-col gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setSelectedRow(null)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- privacy notice ---- */}
      <PrivacyNotice title="Anonymised data">
        All aggregated counts are derived from CyberSaathi&rsquo;s deterministic
        seed data set. No victim identity, phone number, or raw evidence is
        exposed in this police dashboard view.
      </PrivacyNotice>
    </div>
  );
}
