import { ShieldAlert } from "lucide-react";

import { DO_NOT_SHARE_REMINDER } from "./emergency-copy";

/**
 * DoNotShareCard — reminder inside the call script that OTPs, Aadhaar,
 * card numbers, and bank credentials must never be shared — not even
 * with 1930. Red border is intentional: this is a safety boundary, not
 * a status pill.
 */
export function DoNotShareCard() {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-emergency/30 bg-emergency-soft p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emergency">
        <ShieldAlert className="size-3.5" aria-hidden />
        Never share these with anyone — including 1930
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {DO_NOT_SHARE_REMINDER.map((item) => (
          <li
            key={item}
            className="inline-flex items-center gap-1 rounded-full border border-emergency/30 bg-card px-2 py-0.5 text-[11px] font-medium text-emergency"
          >
            {item}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-emergency/90">
        The 1930 helpline will only ask for the transaction SMS, UTR, UPI ID,
        and amount. If anyone asks for the items above, end the call.
      </p>
    </div>
  );
}
