import { ResponseGuideClient } from "@/components/post-report/ResponseGuideClient";

export const metadata = {
  title: "Incident Response Guide — CyberSaathi",
  description:
    "Action checklist, evidence requirements, official portal escalation path, and critical safeguards to secure accounts and report cybercrime.",
};

export default function ResponsePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <ResponseGuideClient />
    </div>
  );
}
