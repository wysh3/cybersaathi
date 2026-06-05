import { AccountabilityClient } from "@/components/accountability/AccountabilityClient";

export const metadata = {
  title: "Accountability engine — CyberSaathi",
  description:
    "When ignored patterns cross the 50-report, 30-day threshold, CyberSaathi turns them into public alerts, journalist digests, and RTI drafts.",
};

export default function AccountabilityPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <AccountabilityClient />
    </div>
  );
}
