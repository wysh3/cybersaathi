import { Phone, Siren } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * EmergencyCTA — sticky/floating call-1930 call-to-action.
 * Red emergency mode is reserved for this component (and the Golden Hour page).
 */
export function EmergencyCTA({
  variant = "primary",
  className,
  trailing,
}: {
  variant?: "primary" | "floating" | "compact";
  className?: string;
  trailing?: React.ReactNode;
}) {
  if (variant === "floating") {
    return (
      <a
        href="tel:1930"
        className={cn(
          "fixed bottom-20 right-4 z-30 inline-flex h-12 items-center gap-2 rounded-full bg-emergency px-4 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-0.5 sm:bottom-6 sm:right-6",
          className,
        )}
        aria-label="Call 1930 cyber crime helpline"
      >
        <Phone data-icon="inline-start" className="size-4" aria-hidden />
        Call 1930
      </a>
    );
  }
  if (variant === "compact") {
    return (
      <Button
        asChild
        size="sm"
        variant="destructive"
        className={cn("rounded-full", className)}
      >
        <a href="tel:1930" aria-label="Call 1930 helpline">
          <Phone data-icon="inline-start" className="size-3.5" aria-hidden />
          Call 1930
        </a>
      </Button>
    );
  }
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border-2 border-emergency bg-emergency-soft p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Siren
          data-icon="inline-start"
          className="size-4 text-emergency"
          aria-hidden
        />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emergency">
          Priority action
        </p>
      </div>
      <Button
        asChild
        size="lg"
        variant="destructive"
        className="h-12 w-full justify-center text-base"
      >
        <a href="tel:1930" aria-label="Call 1930 helpline now">
          <Phone data-icon="inline-start" className="size-5" aria-hidden />
          Call 1930 Now
        </a>
      </Button>
      {trailing}
    </div>
  );
}
