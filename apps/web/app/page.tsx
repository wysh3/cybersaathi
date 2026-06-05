import { ChatIntakeComposer } from "@/components/intake/ChatIntakeComposer";

export const metadata = {
  title: "What happened? — CyberSaathi",
  description:
    "Tell CyberSaathi what happened. We detect urgency, route to the right emergency flow, and prepare the next government-service action.",
};

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <ChatIntakeComposer />
    </div>
  );
}
