import { CaseSummaryCard } from "@/components/app/CaseSummaryCard";

import { formatAmount, formatIncidentLabel } from "./emergency-copy";
import type { ExtractedFacts } from "@/lib/types";

/**
 * CaseBriefCard — the prepared case brief the victim reads out loud
 * on the 1930 call. Composed of the existing CaseSummaryCard so the
 * facts grid stays in sync with Documents.
 */
export function CaseBriefCard({ facts }: { facts: ExtractedFacts | null }) {
  return (
    <CaseSummaryCard
      title="Prepared case brief"
      description="Read out loud on the call."
      facts={[
        {
          label: "Amount",
          value: formatAmount(facts?.amount),
          highlight: true,
        },
        { label: "UPI ID", value: facts?.upi_id ?? null, mono: true },
        { label: "UTR / reference", value: facts?.utr ?? null, mono: true },
        {
          label: "Payment app",
          value: facts?.payment_app ?? facts?.bank ?? null,
        },
        {
          label: "Reported at",
          value: formatIncidentLabel(facts?.timestamp ?? null),
        },
        { label: "Scammer phone", value: facts?.phone ?? null, mono: true },
        ...(facts?.handle
          ? [{ label: "Social handle", value: facts.handle, mono: true }]
          : []),
        ...(facts?.url ? [{ label: "URL", value: facts.url, mono: true }] : []),
      ]}
    />
  );
}
