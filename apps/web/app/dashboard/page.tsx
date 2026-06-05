import { DashboardPageClient } from "@/components/dashboard/DashboardPageClient";

export const metadata = {
  title: "Dashboard — CyberSaathi",
  description:
    "Personal case tracker for citizens and data intelligence for journalists. One app, two views.",
};

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <DashboardPageClient />
    </div>
  );
}
