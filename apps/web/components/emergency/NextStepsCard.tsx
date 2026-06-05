"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useWorkflowStore } from "@/lib/workflow-store";

/**
 * NextStepsCard — "What happens next" with a Skip-to-Documents escape
 * hatch. Hidden in print so the printed case brief stays clean.
 */
export function NextStepsCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { complaintId } = useWorkflowStore();

  return (
    <Card data-print="hide" className="no-print">
      <CardHeader>
        <CardTitle>What happens next</CardTitle>
        <CardDescription>
          Continue into the complaint package once the helpline reference is
          saved.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
        <p>
          We move you to the complaint package: NCRP draft, bank dispute
          email, evidence timeline, and recovery checklist.
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            const caseId = searchParams.get("caseId") || complaintId;
            router.push(`/documents${caseId ? `?caseId=${caseId}` : ""}`);
          }}
        >
          Skip to documents
          <ArrowRight aria-hidden />
        </Button>
      </CardContent>
    </Card>
  );
}
