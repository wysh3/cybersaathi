import { HeatmapPageClient } from "@/components/dashboards/HeatmapPageClient";

export const metadata = {
  title: "India heatmap — CyberSaathi",
  description:
    "Anonymised, aggregate-only view of cyber-fraud reports across Indian states and districts. Click a state for the district breakdown.",
};

export default function HeatmapPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <HeatmapPageClient />
    </div>
  );
}
