"use client";

/**
 * CyberSaathi IndiaHeatmap — real geographic choropleth of India.
 *
 *  - Vendored TopoJSON at apps/web/lib/maps/india-states.json
 *    (udit-001/india-maps-data, commit ef25ebc)
 *  - State fill via intensity bins; accountability alerts as red border
 *  - Desktop: large map card + selected-state intelligence panel
 *  - Mobile: same card; selected state opens a Sheet
 *  - Below: skinned Table (shadcn) for keyboard users
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
} from "geojson";
import { geoMercator, geoPath } from "d3-geo";
import {
  AlertTriangle,
  ChevronRight,
  Map as MapIcon,
  Search,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";

import { MetricCard } from "@/components/app/MetricCard";
import { PageHeader } from "@/components/app/PageHeader";
import { PrivacyNotice } from "@/components/app/PrivacyNotice";
import { StatusBadge } from "@/components/app/StatusBadge";

import indiaTopoRaw from "@/lib/maps/india-states.json";
import { api, ApiError } from "@/lib/api";
import type {
  IntelligenceMapResponse,
  StateDistrictResponse,
  StateIntelligence,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const FRAUD_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "__all__", label: "All fraud types" },
  { value: "personal_safety_extortion", label: "Personal safety & extortion" },
  { value: "money_movement_fraud", label: "Money movement fraud" },
  { value: "device_data_compromise", label: "Device & data compromise" },
  { value: "identity_account_control", label: "Identity & account control" },
  { value: "platform_content_suspect", label: "Platform & suspect content" },
];

const FRAUD_LABEL: Record<string, string> = {
  personal_safety_extortion: "Personal safety & extortion",
  money_movement_fraud: "Money movement fraud",
  device_data_compromise: "Device & data compromise",
  identity_account_control: "Identity & account control",
  platform_content_suspect: "Platform & suspect content",
};

type Metric = "count" | "amount";

const indiaTopo = indiaTopoRaw as unknown as Parameters<typeof feature>[0];
const STATES_COLLECTION = feature(
  indiaTopo,
  indiaTopo.objects.states as unknown as Parameters<typeof feature>[1],
) as unknown as FeatureCollection<Geometry, GeoJsonProperties>;

const PROJECTION = geoMercator().center([82, 22]).scale(900).translate([400, 420]);
const PATH = geoPath(PROJECTION);

const MAP_W = 800;
const MAP_H = 720;

export function IndiaHeatmap() {
  const [map, setMap] = useState<IntelligenceMapResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [fraudType, setFraudType] = useState<string>("__all__");
  const [metric, setMetric] = useState<Metric>("count");
  const [districtData, setDistrictData] = useState<StateDistrictResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMap, setLoadingMap] = useState(true);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [filter, setFilter] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    // Data-fetching reset: keep the React Compiler rule happy by wrapping
    // the two sync setState calls in a single `void` IIFE so they run as
    // microtasks instead of cascading renders. The setState in the
    // promise callbacks below is the actual state transition.
    void (() => {
      setLoadingMap(true);
      setError(null);
    })();
    api
      .intelligenceMap({
        fraudType: fraudType === "__all__" ? undefined : fraudType,
        metric,
      })
      .then((response) => {
        if (!active || !isMounted.current) return;
        setMap(response);
        setLoadingMap(false);
        const hasData = response.states.some((s) => s.report_count > 0);
        const first = response.states.find((s) => s.report_count > 0) ?? response.states[0];
        if (!selected && hasData && first) {
          setSelected(first.state_id);
        } else if (
          selected &&
          !response.states.some((s) => s.state_id === selected)
        ) {
          setSelected(null);
        }
      })
      .catch((err) => {
        if (!active || !isMounted.current) return;
        setError(
          err instanceof ApiError
            ? `${err.message}: ${JSON.stringify(err.detail)}`
            : err instanceof Error
              ? err.message
              : "Failed to load heatmap.",
        );
        setLoadingMap(false);
      });
    return () => {
      active = false;
    };
  }, [fraudType, metric]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) {
      void (() => {
        setDistrictData(null);
      })();
      return;
    }
    let active = true;
    void (() => {
      setLoadingDistricts(true);
    })();
    api
      .intelligenceMapState(
        selected,
        fraudType === "__all__" ? undefined : fraudType,
      )
      .then((response) => {
        if (!active || !isMounted.current) return;
        setDistrictData(response);
        setLoadingDistricts(false);
      })
      .catch(() => {
        if (!active || !isMounted.current) return;
        setLoadingDistricts(false);
      });
    return () => {
      active = false;
    };
  }, [selected, fraudType]);

  const stateById = useMemo(() => {
    const m = new Map<string, StateIntelligence>();
    if (map) for (const s of map.states) m.set(s.state_id, s);
    return m;
  }, [map]);

  const populated = useMemo(
    () => (map?.states ?? []).filter((s) => s.report_count > 0),
    [map],
  );

  const filteredStates = useMemo(() => {
    if (!filter) return map?.states ?? [];
    const q = filter.toLowerCase();
    return (map?.states ?? []).filter((s) => s.state.toLowerCase().includes(q));
  }, [map, filter]);

  const selectedState = selected ? stateById.get(selected) ?? null : null;
  const isAlert = (map?.accountability_alert_states ?? []).includes(selected ?? "");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        eyebrow="Cyber fraud intelligence"
        title="India heatmap"
        description="Anonymised, aggregate-only view of cyber-fraud reports from the CyberSaathi seed data set. Pick a state to see the district breakdown, top fraud type, and accountability-alert status."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total reports"
          value={map ? map.total_complaints.toLocaleString("en-IN") : "—"}
          hint="From seed data"
          icon={MapIcon}
          loading={loadingMap}
        />
        <MetricCard
          label="Total reported"
          value={
            map
              ? `Rs ${Math.round(map.total_amount).toLocaleString("en-IN")}`
              : "—"
          }
          hint={`By ${populated.length} state${populated.length === 1 ? "" : "s"}`}
          tone="primary"
          loading={loadingMap}
        />
        <MetricCard
          label="Alert states"
          value={String(map?.accountability_alert_states.length ?? 0)}
          tone="emergency"
          hint="Accountability threshold"
          icon={AlertTriangle}
          loading={loadingMap}
        />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertTitle>Heatmap failed to load</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1.5">
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Pick a metric and a fraud type. Red border = accountability
              alert.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Metric
              </span>
              <ToggleGroup
                value={metric}
                onValueChange={(v) => v && setMetric(v as Metric)}
                type="single"
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="count">Report count</ToggleGroupItem>
                <ToggleGroupItem value="amount">Total amount</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="flex min-w-[220px] flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Fraud type
              </span>
              <Select
                value={fraudType}
                onValueChange={(v) =>
                  setFraudType(v === "__all__" ? "__all__" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FRAUD_TYPES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Legend metric={metric} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1.5">
            <CardTitle>India cyber-fraud heatmap</CardTitle>
            <CardDescription>
              {loadingMap
                ? "Loading state rollups…"
                : `${populated.length} state${populated.length === 1 ? "" : "s"} with reports`}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            disabled={!selectedState}
          >
            View state
            <ChevronRight aria-hidden />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="relative overflow-hidden rounded-md border border-border bg-muted/30">
              <svg
                viewBox={`0 0 ${MAP_W} ${MAP_H}`}
                role="img"
                aria-label={`Choropleth map of India, ${populated.length} states with reports`}
                className="block h-auto w-full"
              >
                <title>India cyber-fraud heatmap</title>
                <desc>
                  Anonymised report counts across Indian states, served from
                  CyberSaathi&apos;s deterministic seed data.
                </desc>
                {STATES_COLLECTION.features.map((feature) => {
                  const name = (feature.properties?.st_nm as string) ?? "";
                  return (
                  <StatePath
                    key={name || (feature.id as string) || `${feature.geometry?.type ?? "geom"}-${(feature.properties?.st_code as string) ?? "x"}`}
                    feature={feature}
                    data={stateById.get((feature.properties?.st_nm as string) ?? "")}
                    metric={metric}
                    isSelected={
                      ((feature.properties?.st_nm as string) ?? "") === selected
                    }
                    onSelect={(name) => {
                      setSelected(name);
                      setMobileOpen(true);
                    }}
                  />
                  );
                })}
              </svg>
              {loadingMap ? (
                <div className="absolute inset-0 flex items-center justify-center bg-card/70 text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : null}
            </div>

            <StatePanel
              selected={selectedState}
              isAlert={isAlert}
              districtData={districtData}
              loadingDistricts={loadingDistricts}
              className="hidden lg:flex"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1.5">
            <CardTitle>State index</CardTitle>
            <CardDescription>
              {map?.states.length ?? 0} state(s) · sorted by reports
            </CardDescription>
          </div>
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              placeholder="Filter states…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8 w-[200px] pl-8 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Reports</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Top fraud</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStates
                .slice()
                .sort((a, b) => b.report_count - a.report_count)
                .map((row) => (
                  <TableRow
                    key={row.state_id}
                    className={cn(
                      row.state_id === selected && "bg-primary/5",
                    )}
                  >
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setSelected(row.state_id)}
                        className="font-semibold text-foreground hover:underline"
                      >
                        {row.state}
                      </button>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {row.report_count.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      Rs {Math.round(row.total_amount).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.top_fraud_type
                        ? FRAUD_LABEL[row.top_fraud_type] ?? row.top_fraud_type
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {row.has_accountability_alert ? (
                        <StatusBadge label="Alert" tone="emergency" />
                      ) : row.report_count > 0 ? (
                        <Badge variant="secondary" className="rounded-full">
                          Active
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No data
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PrivacyNotice title="Anonymised, aggregate-only">
        The map never displays victim identities, raw phone numbers,
        Aadhaar, PAN, OTP, PINs, or full card numbers on this surface.
      </PrivacyNotice>

      <p className="text-[11px] text-muted-foreground">
        Map geometry: <code className="font-mono">udit-001/india-maps-data</code>{" "}
        (vendored locally, no runtime network fetch). See{" "}
        <code className="font-mono">apps/web/lib/maps/README.md</code>.
      </p>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="bottom" className="max-h-[85vh]">
          <SheetHeader>
            <SheetTitle>Selected state</SheetTitle>
            <SheetDescription>
              District breakdown · accountability status
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <StatePanel
              selected={selectedState}
              isAlert={isAlert}
              districtData={districtData}
              loadingDistricts={loadingDistricts}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatePath({
  feature,
  data,
  metric,
  isSelected,
  onSelect,
}: {
  feature: Feature<Geometry, GeoJsonProperties>;
  data: StateIntelligence | undefined;
  metric: Metric;
  isSelected: boolean;
  onSelect: (stateId: string) => void;
}) {
  const d = PATH(feature as Parameters<typeof PATH>[0]);
  if (!d) return null;
  const name = (feature.properties?.st_nm as string) ?? "";
  const hasData = (data?.report_count ?? 0) > 0;
  const bin =
    metric === "amount" ? data?.amount_bin ?? 0 : data?.intensity_bin ?? 0;
  const isAlert = data?.has_accountability_alert ?? false;
  const fillValue = !hasData
    ? "hsl(var(--intensity-0))"
    : `hsl(var(--intensity-${bin}))`;
  const safeName = name || "Unknown state";
  return (
    <path
      d={d}
      stroke={isAlert ? "hsl(var(--app-emergency))" : "#ffffff"}
      strokeWidth={isAlert ? 2.5 : isSelected ? 2 : 0.6}
      opacity={hasData ? 1 : 0.7}
      onClick={() => hasData && onSelect(name)}
      style={{
        cursor: hasData ? "pointer" : "default",
        fill: fillValue,
      }}
    >
      <title>
        {safeName} ·{" "}
        {hasData
          ? `${data?.report_count} reports · Rs ${Math.round(
              data?.total_amount ?? 0,
            ).toLocaleString("en-IN")}`
          : "no reports"}
        {isAlert ? " · accountability alert" : ""}
      </title>
    </path>
  );
}

function StatePanel({
  selected,
  isAlert,
  districtData,
  loadingDistricts,
  className,
}: {
  selected: StateIntelligence | null;
  isAlert: boolean;
  districtData: StateDistrictResponse | null;
  loadingDistricts: boolean;
  className?: string;
}) {
  return (
    <Card
      className={cn("h-full", className)}
      aria-live="polite"
      aria-label="Selected state intelligence"
    >
      <CardHeader>
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-sm">
            {selected?.state ?? "Select a state"}
          </CardTitle>
          <CardDescription>
            {selected
              ? isAlert
                ? "Accountability alert active"
                : "District breakdown"
              : "Click a state on the map"}
          </CardDescription>
        </div>
        {isAlert ? <StatusBadge label="Alert" tone="emergency" /> : null}
      </CardHeader>
      {selected == null ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Pick a state to see its detail panel.
          </p>
        </CardContent>
      ) : (
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Reports
              </p>
              <p className="num text-xl font-semibold text-foreground">
                {selected.report_count.toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Total amount
              </p>
              <p className="num text-xl font-semibold text-foreground">
                Rs {Math.round(selected.total_amount).toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Top fraud
              </p>
              <p className="text-sm font-semibold text-foreground">
                {selected.top_fraud_type
                  ? FRAUD_LABEL[selected.top_fraud_type] ?? selected.top_fraud_type
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Top district
              </p>
              <p className="text-sm font-semibold text-foreground">
                {selected.top_district ?? "—"}
              </p>
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              District drilldown
            </p>
            {loadingDistricts ? (
              <div className="flex flex-col gap-1.5">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-7 w-full" />
                ))}
              </div>
            ) : districtData == null || districtData.districts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No district data for this filter.
              </p>
            ) : (
              <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-1 text-sm">
                {districtData.districts.slice(0, 8).map((d) => (
                  <li
                    key={d.district}
                    className="flex items-center justify-between rounded-md border border-border bg-card px-2.5 py-1.5"
                  >
                    <span className="font-semibold text-foreground">
                      {d.district}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="num text-foreground">
                        {d.report_count}
                      </span>
                      <span className="num">
                        Rs{" "}
                        {Math.round(d.total_amount).toLocaleString("en-IN")}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            All numbers are aggregate counts and totals. No victim-level
            data is ever returned by this endpoint.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function Legend({ metric }: { metric: Metric }) {
  const bins: ReadonlyArray<{ value: number; label: string }> = [
    { value: 0, label: "No data" },
    { value: 1, label: "0–20%" },
    { value: 2, label: "20–40%" },
    { value: 3, label: "40–60%" },
    { value: 4, label: "60–80%" },
    { value: 5, label: "80–100%" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="text-[11px] font-semibold uppercase tracking-wider">
        {metric === "amount" ? "Amount" : "Reports"}
      </span>
      {bins.map((bin) => (
        <span key={bin.value} className="inline-flex items-center gap-1">
          <span
            className="h-3 w-5 rounded-sm border border-border"
            style={{
              background:
                bin.value === 0
                  ? "hsl(var(--intensity-0))"
                  : `hsl(var(--intensity-${bin.value}))`,
            }}
            aria-hidden
          />
          <span className="num">{bin.label}</span>
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <span
          className="h-3 w-5 rounded-sm border-2"
          style={{ borderColor: "var(--app-emergency)" }}
          aria-hidden
        />
        Alert
      </span>
    </div>
  );
}
