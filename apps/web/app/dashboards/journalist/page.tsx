import { JournalistDashboardClient } from "@/components/dashboards/JournalistDashboardClient";

export const metadata = {
  title: "Journalist dashboard — CyberSaathi",
  description:
    "Aggregated fraud trends, accountability alerts, and RTI draft generator for journalists and researchers.",
};

export default function JournalistDashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <JournalistDashboardClient />
    </div>
  );
}
