import { ShieldCheck, ShieldOff } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

/**
 * PrivacyNotice — small privacy/safety callout used on intake,
 * documents, and dashboards. Tone="good" for "we redact" type notes,
 * tone="alert" for "do not share" type warnings.
 */
export function PrivacyNotice({
  title,
  children,
  tone = "good",
  className,
}: {
  title: string;
  children: React.ReactNode;
  tone?: "good" | "alert";
  className?: string;
}) {
  return (
    <Alert
      className={cn(
        tone === "alert" &&
          "border-emergency/20 bg-emergency-soft text-emergency [&>svg]:text-emergency",
        className,
      )}
    >
      {tone === "alert" ? (
        <ShieldOff aria-hidden />
      ) : (
        <ShieldCheck aria-hidden />
      )}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
