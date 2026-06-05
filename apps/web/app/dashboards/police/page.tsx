import { PoliceDashboardClient } from "@/components/dashboards/PoliceDashboardClient";

export const metadata = {
  title: "Police demo dashboard — CyberSaathi",
  description:
    "Aggregated jurisdictional view for police demo. Filter by state and district; no PII is shown.",
};

export default function PoliceDashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PoliceDashboardClient />
    </div>
  );
}
