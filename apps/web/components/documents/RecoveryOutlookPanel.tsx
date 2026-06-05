import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { DataPanel } from "@/components/app/DataPanel";

import type { RecoveryBand } from "@/lib/types";

/**
 * RecoveryOutlookPanel — sidebar panel showing the deterministic
 * recovery band. Range, never a single number; lists the factors
 * that pushed the band into its current bucket.
 */
export function RecoveryOutlookPanel({
  recovery,
}: {
  recovery: RecoveryBand | null;
}) {
  return (
    <DataPanel
      title="Recovery outlook"
      description="No guarantee · reporting quickly may improve fund-blocking chances"
    >
      {recovery ? (
        <>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-semibold text-foreground">
              {recovery.label}
            </p>
            <Badge
              variant="outline"
              className="rounded-full font-mono tabular-nums"
            >
              {recovery.low_pct}% – {recovery.high_pct}%
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{recovery.explanation}</p>
          <Separator />
          <ul className="flex flex-col gap-1.5 text-sm text-foreground">
            {recovery.factors.map((factor) => (
              <li key={factor} className="flex items-start gap-2">
                <span
                  className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-primary"
                  aria-hidden
                />
                {factor}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
    </DataPanel>
  );
}
