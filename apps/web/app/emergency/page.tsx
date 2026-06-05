import { EmergencyClient } from "@/components/emergency/EmergencyClient";

export const metadata = {
  title: "Golden Hour — Call 1930 — CyberSaathi",
  description:
    "Golden hour emergency mode: call 1930, follow the prepared script, capture the reference number, and move to the complaint package.",
};

export default function EmergencyPage() {
  return <EmergencyClient />;
}
