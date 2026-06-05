import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { DataPanel } from "@/components/app/DataPanel";

import type { SimilarityResult } from "@/lib/types";

/**
 * SimilarReportsPanel — sidebar panel showing the top 3 similar
 * reports from the seed data. Counts come from the seed (no live
 * inference), per the AGENTS.md privacy posture.
 */
export function SimilarReportsPanel({
  similarity,
}: {
  similarity: SimilarityResult | null;
}) {
  return (
    <DataPanel
      title="Similar reports"
      description="Counts come from the seed data — not live."
    >
      {similarity ? (
        similarity.matches.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {similarity.matches.slice(0, 3).map((match, idx) => (
              <li
                key={`${match.identifier_type}-${idx}`}
                className="flex flex-col gap-0.5 rounded-md border border-border bg-muted/30 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {match.identifier_type.replace("_", " ")}
                  </p>
                  <Badge
                    variant="secondary"
                    className="rounded-full font-mono"
                  >
                    {match.match_count} reports
                  </Badge>
                </div>
                <p className="break-all font-mono text-sm font-medium text-foreground">
                  {match.identifier_value}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Districts:{" "}
                  {match.sample_districts.slice(0, 3).join(", ") || "—"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No matching identifiers in the seed data yet. Submit more
            complaints to build a pattern.
          </p>
        )
      ) : (
        <Skeleton className="h-12 w-full" />
      )}
    </DataPanel>
  );
}
