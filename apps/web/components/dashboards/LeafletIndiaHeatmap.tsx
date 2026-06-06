"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import { X, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  State name normaliser                                            */
/* ------------------------------------------------------------------ */

const STATE_NAME_MAP: Record<string, string> = {
  "Andaman and Nicobar": "Andaman and Nicobar",
  "Andhra Pradesh": "Andhra Pradesh",
  "Arunachal Pradesh": "Arunachal Pradesh",
  Assam: "Assam",
  Bihar: "Bihar",
  Chandigarh: "Chandigarh",
  Chhattisgarh: "Chhattisgarh",
  "Dadra and Nagar Haveli": "Dadra and Nagar Haveli",
  "Daman and Diu": "Daman and Diu",
  Delhi: "Delhi",
  Goa: "Goa",
  Gujarat: "Gujarat",
  Haryana: "Haryana",
  "Himachal Pradesh": "Himachal Pradesh",
  "Jammu and Kashmir": "Jammu and Kashmir",
  Jharkhand: "Jharkhand",
  Karnataka: "Karnataka",
  Kerala: "Kerala",
  Lakshadweep: "Lakshadweep",
  "Madhya Pradesh": "Madhya Pradesh",
  Maharashtra: "Maharashtra",
  Manipur: "Manipur",
  Meghalaya: "Meghalaya",
  Mizoram: "Mizoram",
  Nagaland: "Nagaland",
  Orissa: "Odisha",
  Puducherry: "Puducherry",
  Punjab: "Punjab",
  Rajasthan: "Rajasthan",
  Sikkim: "Sikkim",
  "Tamil Nadu": "Tamil Nadu",
  Tripura: "Tripura",
  "Uttar Pradesh": "Uttar Pradesh",
  Uttaranchal: "Uttarakhand",
  "West Bengal": "West Bengal",
};

/* ------------------------------------------------------------------ */
/*  Colour scale                                                     */
/* ------------------------------------------------------------------ */

function colourForCount(count: number, max: number): string {
  if (max === 0 || count === 0) return "rgba(200,200,200,0.4)";
  const t = count / max;
  const h = 50 - t * 50;
  return `hsl(${h}, 100%, ${50 - t * 8}%)`;
}

/* ------------------------------------------------------------------ */
/*  Types                                                            */
/* ------------------------------------------------------------------ */

interface DistrictData {
  state: string;
  districts: Record<string, number>;
  fraud_types: Record<string, number>;
  total_complaints: number;
  total_amount: number;
  district_count: number;
}

/* ------------------------------------------------------------------ */
/*  Loading / Error states                                           */
/* ------------------------------------------------------------------ */

function MapFallback() {
  return (
    <div className="flex h-[560px] items-center justify-center rounded-xl bg-white/50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
        <p className="text-sm text-ink-600">Loading map...</p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-[560px] flex-col items-center justify-center gap-2 rounded-xl bg-white/50">
      <p className="text-sm font-medium text-emergency">Failed to load map</p>
      <p className="text-xs text-ink-500">{message}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Legend                                                           */
/* ------------------------------------------------------------------ */

function Legend({ maxCount }: { maxCount: number }) {
  if (maxCount === 0) return null;
  const steps = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  return (
    <div className="absolute right-3 top-3 z-[1000] rounded-xl bg-white/92 px-3 py-2 shadow-glass">
      <p className="text-[10px] font-semibold text-ink-700">Reports</p>
      {steps.map((t) => (
        <div key={t} className="mt-0.5 flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-5 rounded-sm border border-white/60"
            style={{
              backgroundColor: colourForCount(
                Math.max(1, Math.round(t * maxCount)),
                maxCount,
              ),
            }}
          />
          <span className="num text-[10px] text-ink-600">
            {t === 0 ? "0" : Math.round(t * maxCount)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  District bar chart panel (slide-in when state clicked)            */
/* ------------------------------------------------------------------ */

const FRAUD_LABELS: Record<string, string> = {
  personal_safety_extortion: "Personal Safety & Extortion",
  money_movement_fraud: "Money Movement Fraud",
  device_data_compromise: "Device & Data Compromise",
  identity_account_control: "Identity & Account Control",
  platform_content_suspect: "Platform & Suspect Content",
};

function formatINR(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)} L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n}`;
}

function DistrictPanel({
  data,
  onClose,
}: {
  data: DistrictData;
  onClose: () => void;
}) {
  const districtEntries = Object.entries(data.districts);
  const maxDistrict = Math.max(1, ...Object.values(data.districts));

  return (
    <div className="absolute bottom-4 left-4 right-4 z-[1000] max-h-[55%] overflow-y-auto rounded-xl border border-white/70 bg-white/94 p-5 shadow-glass animate-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink-900">{data.state}</h3>
          <p className="mt-0.5 text-xs text-ink-500">
            {data.total_complaints} reports · {data.district_count} districts ·{" "}
            {formatINR(data.total_amount)} total
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-ink-400 transition-colors hover:bg-sky-50 hover:text-ink-700"
          aria-label="Close district panel"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* District bar chart */}
      <div className="mb-4 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          Reports by District
        </p>
        {districtEntries.map(([name, count]) => (
          <div key={name} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate text-xs font-medium text-ink-700">
              {name}
            </span>
            <div className="flex flex-1 items-center gap-2">
              <div className="h-5 flex-1 overflow-hidden rounded-full bg-sky-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(count / maxDistrict) * 100}%`,
                    backgroundColor: colourForCount(count, maxDistrict),
                  }}
                />
              </div>
              <span className="num w-8 text-right text-xs font-semibold text-ink-600">
                {count}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Fraud type breakdown */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          Fraud Types
        </p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(data.fraud_types).map(([type, count]) => (
            <span
              key={type}
              className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-ink-700"
            >
              {FRAUD_LABELS[type] ?? type}
              <span className="num text-ink-400">{count}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dynamic leaflet imports (client-side only)                        */
/* ------------------------------------------------------------------ */

/* eslint-disable @typescript-eslint/no-explicit-any */
let _leafletModule: any = null;

async function initLeaflet() {
  _leafletModule = await import("react-leaflet");
  // Pre-load the useMap hook for zoom-to-feature
  await import("react-leaflet");
}

function MapContainer_(props: any) {
  const MC = _leafletModule.MapContainer;
  return <MC {...props} />;
}
function TileLayer_(props: any) {
  const TL = _leafletModule.TileLayer;
  return <TL {...props} />;
}
function GeoJSON_(props: any) {
  const GJ = _leafletModule.GeoJSON;
  return <GJ {...props} />;
}

/* ------------------------------------------------------------------ */
/*  ChoroplethMap (rendered after data + leaflet are ready)           */
/* ------------------------------------------------------------------ */

function ChoroplethMap({
  geoData,
  stateCounts,
  maxCount,
  selectedState,
  onStateClick,
}: {
  geoData: FeatureCollection;
  stateCounts: Record<string, number>;
  maxCount: number;
  selectedState: string | null;
  onStateClick: (stateName: string, feature: Feature<Geometry>) => void;
}) {
  const stateStyle = useCallback(
    (feature?: Feature<Geometry, Record<string, unknown>>) => {
      const geoName = String(feature?.properties?.NAME_1 ?? "");
      const normalised = STATE_NAME_MAP[geoName] ?? geoName;
      const count = stateCounts[normalised] ?? 0;
      const isSelected = selectedState === normalised;
      return {
        fillColor: colourForCount(count, maxCount),
        weight: isSelected ? 3 : 1,
        opacity: 1,
        color: isSelected ? "#1f7eea" : "#ffffff",
        fillOpacity: isSelected ? 0.95 : count > 0 ? 0.8 : 0.4,
        dashArray: isSelected ? "" : "",
      };
    },
    [stateCounts, maxCount, selectedState],
  );

  const onEachFeature = useCallback(
    (
      feature: Feature<Geometry, Record<string, unknown>>,
      layer: L.GeoJSON,
    ) => {
      const geoName = String(feature.properties?.NAME_1 ?? "Unknown");
      const normalised = STATE_NAME_MAP[geoName] ?? geoName;
      const count = stateCounts[normalised] ?? 0;
      layer.bindTooltip(
        `<strong>${geoName}</strong><br/>Reports: ${count}`,
        { sticky: true, direction: "top", className: "custom-choropleth-tooltip" },
      );
      layer.on({
        click: () => onStateClick(normalised, feature as Feature<Geometry>),
      });
    },
    [stateCounts, onStateClick],
  );

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-white/70 shadow-glass">
      <MapContainer_
        key="india-choropleth"
        center={[22.5, 79]}
        zoom={4.5}
        maxZoom={10}
        minZoom={4}
        scrollWheelZoom
        style={{ height: "560px", width: "100%", borderRadius: "inherit" }}
      >
        <TileLayer_
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON_
          key={`geo-${selectedState ?? "none"}-${JSON.stringify(stateCounts)}`}
          data={geoData}
          style={stateStyle}
          onEachFeature={onEachFeature}
        />
      </MapContainer_>

      {/* Legend — only show when no state selected */}
      {!selectedState && <Legend maxCount={maxCount} />}

      {/* Back to India button */}
      {selectedState && (
        <button
          onClick={() => onStateClick("", null as any)}
          className="absolute right-3 top-3 z-[1000] flex items-center gap-1.5 rounded-full border border-white/70 bg-white/92 px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-glass transition-colors hover:bg-white"
        >
          <ArrowLeft className="size-3.5" />
          Back to India
        </button>
      )}

      <style jsx global>{`
        .custom-choropleth-tooltip {
          background: rgba(255, 255, 255, 0.92) !important;
          border: 1px solid rgba(0, 0, 0, 0.15) !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
          padding: 6px 10px !important;
          font-family: var(--font-plex-sans), system-ui, sans-serif !important;
          font-size: 13px !important;
          line-height: 1.4 !important;
          color: hsl(215, 67%, 12%) !important;
          pointer-events: none !important;
        }
        .custom-choropleth-tooltip::before {
          border-top-color: rgba(255, 255, 255, 0.92) !important;
        }
        .leaflet-interactive {
          cursor: pointer !important;
          transition: fill-opacity 200ms ease;
        }
        .leaflet-interactive:hover {
          fill-opacity: 0.95 !important;
          stroke-width: 2 !important;
        }
        @keyframes slide-in-from-bottom-4 {
          from {
            transform: translateY(1rem);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-in {
          animation: slide-in-from-bottom-4 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported public component                                        */
/* ------------------------------------------------------------------ */

export function LeafletIndiaHeatmap() {
  const [mounted, setMounted] = useState(false);
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const [stateCounts, setStateCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drill-down state
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [districtData, setDistrictData] = useState<DistrictData | null>(null);
  const [districtLoading, setDistrictLoading] = useState(false);

  useEffect(() => {
    initLeaflet()
      .then(() => setMounted(true))
      .catch((e) => setError(e instanceof Error ? e.message : "Leaflet init failed"));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    async function load() {
      try {
        const [geoRes, countsData] = await Promise.all([
          fetch("/india_state.geojson"),
          api.mapStates(),
        ]);
        if (!geoRes.ok) throw new Error("Failed to load GeoJSON");
        const geoJson = (await geoRes.json()) as FeatureCollection;
        if (cancelled) return;
        setGeoData(geoJson);
        setStateCounts(countsData.states);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  /** Handle state click → fetch district data */
  const handleStateClick = useCallback(
    async (stateName: string) => {
      // If clicking "back" or same state → deselect
      if (!stateName || stateName === selectedState) {
        setSelectedState(null);
        setDistrictData(null);
        return;
      }

      setSelectedState(stateName);
      setDistrictLoading(true);
      setDistrictData(null);

      try {
        const data = await api.mapStateDistricts(stateName);
        setDistrictData(data);
      } catch {
        setDistrictData(null);
      } finally {
        setDistrictLoading(false);
      }
    },
    [selectedState],
  );

  const maxCount = useMemo(
    () => Math.max(1, ...Object.values(stateCounts)),
    [stateCounts],
  );

  if (error) return <ErrorState message={error} />;
  if (!mounted || loading || !geoData) return <MapFallback />;

  return (
    <div className="relative">
      <ChoroplethMap
        geoData={geoData}
        stateCounts={stateCounts}
        maxCount={maxCount}
        selectedState={selectedState}
        onStateClick={(name) => handleStateClick(name)}
      />

      {/* District panel overlay */}
      {selectedState && (
        districtLoading ? (
          <div className="absolute bottom-4 left-4 right-4 z-[1000] rounded-xl border border-white/70 bg-white/94 p-6 shadow-glass animate-in">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              <p className="text-sm text-ink-600">
                Loading {selectedState} districts...
              </p>
            </div>
          </div>
        ) : districtData ? (
          <DistrictPanel
            data={districtData}
            onClose={() => {
              setSelectedState(null);
              setDistrictData(null);
            }}
          />
        ) : null
      )}
    </div>
  );
}
