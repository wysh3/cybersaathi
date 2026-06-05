"use client";

/**
 * EmergencyClient — premium emergency cockpit for the Golden Hour flow.
 *
 * Red is reserved for this page. Layout:
 *   - Top: EmergencyHeader (siren status + serif title + explanation)
 *   - Two columns on desktop:
 *       Left:  CountdownCard · CaseBriefCard · CallScriptCard
 *       Right: DuringCallCard · HelplineReferenceForm · NextStepsCard · GoldenHourDefinitionCard
 *
 * The page is a thin orchestrator — all visual responsibility is
 * delegated to the components in this folder so each piece can be
 * reused or tested in isolation.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useWorkflowStore } from "@/lib/workflow-store";

import { CallScriptCard } from "./CallScriptCard";
import { CaseBriefCard } from "./CaseBriefCard";
import { CountdownCard } from "./CountdownCard";
import { DuringCallCard } from "./DuringCallCard";
import { EmergencyEmptyState } from "./EmergencyEmptyState";
import { EmergencyHeader } from "./EmergencyHeader";
import { GoldenHourDefinitionCard } from "./GoldenHourDefinitionCard";
import { HelplineReferenceForm } from "./HelplineReferenceForm";
import { NextStepsCard } from "./NextStepsCard";

export function EmergencyClient() {
  const searchParams = useSearchParams();
  const {
    routing,
    extractedFacts,
    setHelplineReference,
    helplineReference,
    hydrateFromCaseId,
    caseId: storeCaseId,
  } = useWorkflowStore();
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  useEffect(() => {
    const caseId = searchParams.get("caseId");
    if (caseId && !routing && !storeCaseId) {
      hydrateFromCaseId(caseId).catch(() => {});
    }
  }, [searchParams, routing, storeCaseId, hydrateFromCaseId]);

  useEffect(() => {
    if (routing?.golden_hour_remaining_seconds != null) {
      void (() => {
        setRemainingSeconds(routing.golden_hour_remaining_seconds);
      })();
    }
  }, [routing?.golden_hour_remaining_seconds]);

  useEffect(() => {
    if (remainingSeconds == null) return;
    if (remainingSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((value) =>
        value == null ? null : Math.max(0, value - 1),
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [remainingSeconds]);

  if (!routing || !extractedFacts) {
    return <EmergencyEmptyState />;
  }

  const minutes = remainingSeconds != null ? Math.floor(remainingSeconds / 60) : 0;
  const seconds = remainingSeconds != null ? remainingSeconds % 60 : 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6" data-print="root">
      <EmergencyHeader />

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col gap-4">
          <CountdownCard
            minutes={minutes}
            seconds={seconds}
            incidentAt={extractedFacts.timestamp ?? null}
          />
          <CaseBriefCard facts={extractedFacts} />
          <CallScriptCard facts={extractedFacts} />
        </div>

        <div className="flex flex-col gap-4">
          <DuringCallCard />
          <HelplineReferenceForm
            initialReference={helplineReference ?? null}
            onSubmitted={() => {
              setHelplineReference(helplineReference ?? "");
            }}
          />
          <NextStepsCard />
          <GoldenHourDefinitionCard />
        </div>
      </div>
    </div>
  );
}
