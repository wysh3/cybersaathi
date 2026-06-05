import { JudgeDemo } from "@/components/demo/JudgeDemo";

export const metadata = {
  title: "90-second demo — CyberSaathi",
  description:
    "A guided walkthrough of CyberSaathi's six-step emergency-navigation pipeline, using the same seed data and APIs the real product uses.",
};

export default function DemoPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <JudgeDemo />
    </div>
  );
}
