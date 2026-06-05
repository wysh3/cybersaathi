"use client";

import { useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { ExtractedFacts } from "@/lib/types";

import { DoNotShareCard } from "./DoNotShareCard";
import {
  CALL_SCRIPT_ENGLISH,
  CALL_SCRIPT_HINDI,
  type CallScriptLanguage,
} from "./emergency-copy";

function fillLine(line: string, facts: ExtractedFacts | null): string {
  return line
    .replace(
      "{amount}",
      facts?.amount ? `Rs ${facts.amount.toLocaleString("en-IN")}` : "—",
    )
    .replace("{upi_id}", facts?.upi_id ?? "—")
    .replace("{utr}", facts?.utr ?? "—")
    .replace("{payment_app}", facts?.payment_app ?? "—")
    .replace("{phone}", facts?.phone ?? "—");
}

/**
 * CallScriptCard — bilingual (Hindi / English) call script the victim
 * reads out loud to 1930. Includes the do-not-share reminder at the
 * bottom so the OTPs / Aadhaar warning is always one glance away.
 */
export function CallScriptCard({ facts }: { facts: ExtractedFacts | null }) {
  const [scriptLang, setScriptLang] = useState<CallScriptLanguage>("hi");

  const callScript = useMemo(() => {
    return {
      hi: CALL_SCRIPT_HINDI.map((line) => fillLine(line, facts)),
      en: CALL_SCRIPT_ENGLISH.map((line) => fillLine(line, facts)),
    } as const;
  }, [facts]);

  const visibleScript = callScript[scriptLang];

  return (
    <Card data-print="surface">
      <CardHeader>
        <div className="flex flex-col gap-2">
          <CardTitle>Exact call script</CardTitle>
          <CardDescription>
            Read out loud, in order. Slow is fine.
          </CardDescription>
        </div>
        <Tabs
          value={scriptLang}
          onValueChange={(v) => setScriptLang(v as CallScriptLanguage)}
        >
          <TabsList aria-label="Call script language">
            <TabsTrigger value="hi">हिन्दी</TabsTrigger>
            <TabsTrigger value="en">English</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ol
          role="tabpanel"
          id="call-script-panel"
          aria-label={`Call script in ${scriptLang === "hi" ? "Hindi" : "English"}`}
          className="flex flex-col gap-2"
        >
          {visibleScript.map((line, idx) => (
            <li
              key={idx}
              className="flex items-start gap-3 rounded-md border border-border bg-muted/40 px-3 py-2"
            >
              <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-emergency text-[11px] font-semibold text-emergency-foreground">
                {idx + 1}
              </span>
              <span className="text-sm leading-relaxed text-foreground">
                {line}
              </span>
            </li>
          ))}
        </ol>
        <DoNotShareCard />
      </CardContent>
    </Card>
  );
}
