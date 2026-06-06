import { DocumentPackage } from "@/components/documents/DocumentPackage";

export const metadata = {
  title: "Documents — CyberSaathi",
  description:
    "Editable NCRP complaint draft, bank dispute email, evidence timeline, and recovery checklist.",
};

export default function DocumentsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <DocumentPackage />
    </div>
  );
}
