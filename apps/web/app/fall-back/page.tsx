import { FallBackClient } from "@/components/fall-back/FallBackClient";

export const metadata = {
  title: "Fall-Back guided flow — CyberSaathi",
  description:
    "A short, supportive guided flow for cases that do not fit the standard routes (sextortion, job scam, account hack).",
};

export default function FallBackPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <FallBackClient />
    </div>
  );
}
