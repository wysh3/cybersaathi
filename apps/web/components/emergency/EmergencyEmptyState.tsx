import { Siren } from "lucide-react";

import { EmptyState } from "@/components/app/EmptyState";

/**
 * EmergencyEmptyState — shown when the user navigates directly to
 * /emergency without an active case. Points them back to intake.
 */
export function EmergencyEmptyState() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <EmptyState
        icon={Siren}
        title="No active case yet"
        description="You reached the Golden Hour page directly. To use the countdown, call script, and helpline capture, start from the intake form and describe what happened."
        primaryAction={{ label: "Open intake form", href: "/" }}
        secondaryAction={{ label: "Call 1930 now", href: "tel:1930" }}
      />
      <p className="text-center text-xs text-muted-foreground">
        CyberSaathi never places the call on your behalf. The 1930 button is
        a placeholder tel: link.
      </p>
    </div>
  );
}
