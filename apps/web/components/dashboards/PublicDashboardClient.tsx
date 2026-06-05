"use client";

/**
 * Public dashboard — aggregate cyber-fraud view for citizens and media.
 * Anonymised, no PII, no raw evidence, no victim identities.
 */

import { useEffect, useMemo, useState } from "react";
import { Megaphone, MapPin, ShieldCheck, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

import { MetricCard } from "@/components/app/MetricCard";
import { PageHeader } from "@/components/app/PageHeader";
import { PrivacyNotice } from "@/components/app/PrivacyNotice";
import { EmptyState } from "@/components/app/EmptyState";

import { api, ApiError } from "@/lib/api";
import type { HeatmapBucket, PublicDashboard } from "@/lib/types";

import { AccountabilityAlertCard } from "./AccountabilityAlertCard";

const FRAUD_LABEL: Record<string, string> = {
  personal_safety_extortion: "Personal safety & extortion",
  money_movement_fraud: "Money movement fraud",
  device_data_compromise: "Device & data compromise",
  identity_account_control: "Identity & account control",
  platform_content_suspect: "Platform & suspect content",
};

export function PublicDashboardClient() {
  const [data, setData] = useState<PublicDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<string>("__all__");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (() => {
      setLoading(true);
      setError(null);
    })();
    api
      .publicDashboard(state === "__all__" ? undefined : state)
      .then((response) => {
        if (active) {
          setData(response);
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
              : "Failed to load dashboard.",
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [state]);

  const topStates = useMemo(() => data?.top_states ?? [], [data?.top_states]);
  const alerts = useMemo(
    () => (data?.accountability_alerts ?? []).filter((a) => a.is_public),
    [data?.accountability_alerts],
  );
  const maxCount = useMemo(
    () => topStates.reduce((m, b) => Math.max(m, b.count), 0) || 1,
    [topStates],
  );
  const districtsCount = useMemo(
    () => new Set(data?.buckets.map((b) => `${b.state}/${b.district}`) ?? []).size,
    [data],
  );
  const stateOptions = useMemo(
    () => Array.from(new Set(topStates.map((b) => b.state))).sort(),
    [topStates],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        eyebrow="Public dashboard"
        title="Cyber fraud patterns across India"
        description="Anonymised, aggregate-only view sourced from the CyberSaathi seed data set. No victim identities, no full phone numbers, no raw evidence."
        actions={
          <Select value={state} onValueChange={setState}>
            <SelectTrigger className="w-[200px]" aria-label="Filter by state">
              <SelectValue placeholder="All states" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All states</SelectItem>
              {stateOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <AccountabilityAlertCard alerts={alerts} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total reports"
          value={data ? data.total_complaints.toLocaleString("en-IN") : "—"}
          hint="From seed dataset"
          loading={loading}
        />
        <MetricCard
          label="Total reported amount"
          value={
            data
              ? `Rs ${Math.round(data.total_reported_amount).toLocaleString("en-IN")}`
              : "—"
          }
          hint="Self-reported loss"
          tone="primary"
          loading={loading}
        />
        <MetricCard
          label="Districts covered"
          value={data ? districtsCount.toLocaleString("en-IN") : "—"}
          hint="Aggregate buckets"
          icon={MapPin}
          loading={loading}
        />
        <MetricCard
          label="Accountability alerts"
          value={data ? data.accountability_alerts.length.toString() : "—"}
          hint="Clusters ≥ 50 reports"
          tone="emergency"
          icon={Megaphone}
          loading={loading}
        />
      </div>

      {error ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertTitle>Dashboard failed to load</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-0.5">
            <CardTitle>Top jurisdictions</CardTitle>
            <CardDescription>
              {loading
                ? "Loading…"
                : `${topStates.length} jurisdiction bucket${topStates.length === 1 ? "" : "s"}`}
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
          ) : topStates.length === 0 ? (
            <EmptyState
              title="No data for the current filter"
              description="Try clearing the state filter to see the full national picture."
              icon={ShieldCheck}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {topStates.slice(0, 12).map((bucket) => (
                <BucketRow
                  key={`${bucket.state}-${bucket.district}`}
                  bucket={bucket}
                  maxCount={maxCount}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <PrivacyNotice title="Anonymised, aggregate-only">
        All data on this surface is aggregate, anonymised, and sourced from
        a versioned seed data set. CyberSaathi never displays names, full
        phone numbers, raw screenshots, or unredacted bank details on public
        surfaces.
      </PrivacyNotice>
    </div>
  );
}

function BucketRow({
  bucket,
  maxCount,
}: {
  bucket: HeatmapBucket;
  maxCount: number;
}) {
  const widthPct = Math.max(4, Math.round((bucket.count / maxCount) * 100));
  return (
    <li>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>
          <span className="font-semibold text-foreground">
            {bucket.district}
          </span>
          <span className="text-muted-foreground"> · {bucket.state}</span>
        </span>
        <span className="num text-muted-foreground">
          {bucket.count} reports · Rs{" "}
          {Math.round(bucket.total_amount).toLocaleString("en-IN")}
        </span>
      </div>
      <Progress value={widthPct} className="h-1.5" />
      <p className="mt-1 text-[11px] text-muted-foreground">
        Top:{" "}
        {bucket.top_fraud_types
          .slice(0, 3)
          .map((ft) => FRAUD_LABEL[ft] ?? ft)
          .join(", ")}
      </p>
    </li>
  );
}
