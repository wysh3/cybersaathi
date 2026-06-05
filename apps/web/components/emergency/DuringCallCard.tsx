import { CircleCheck } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { DURING_CALL_CHECKLIST } from "./emergency-copy";

/**
 * DuringCallCard — checklist of behaviour the victim should follow
 * while 1930 is on the line. Sits to the right of the call script on
 * desktop, below it on mobile.
 */
export function DuringCallCard() {
  return (
    <Card data-print="surface">
      <CardHeader>
        <CardTitle>During the call</CardTitle>
        <CardDescription>Things to keep in mind.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2 text-sm text-foreground">
          {DURING_CALL_CHECKLIST.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CircleCheck
                className="mt-0.5 size-3.5 shrink-0 text-primary"
                aria-hidden
              />
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
