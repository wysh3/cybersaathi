"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { CircleCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CircleAlert } from "lucide-react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { api, ApiError } from "@/lib/api";
import { useWorkflowStore } from "@/lib/workflow-store";
import type { ComplaintRecord, ExtractedFacts, Pipeline } from "@/lib/types";

/**
 * HelplineReferenceForm — the form that captures the 1930 reference
 * number after the call. Owns the API round trip; the parent
 * EmergencyClient supplies the store setters.
 */
export function HelplineReferenceForm({
  initialReference,
  onSubmitted,
}: {
  initialReference?: string | null;
  onSubmitted?: (complaint: ComplaintRecord) => void;
}) {
  const router = useRouter();
  const {
    sessionId,
    routing,
    extractedFacts,
    setError,
    setHelplineReference,
    setComplaint,
    helplineReference,
    lastError,
    incidentAtIso,
    draftDescription,
    draftPaymentMethod,
  } = useWorkflowStore();

  const [reference, setReference] = useState<string>(initialReference ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(Boolean(helplineReference));

  async function ensureComplaint(): Promise<ComplaintRecord> {
    if (!sessionId) {
      throw new Error("No active session. Please return to intake.");
    }
    if (!routing) {
      throw new Error("No routing decision. Please return to intake.");
    }
    const effectiveIncidentAt = incidentAtIso ?? extractedFacts?.timestamp ?? null;
    const facts: ExtractedFacts = extractedFacts ?? {
      utr: null,
      upi_id: null,
      amount: null,
      timestamp: null,
      bank: null,
      payment_app: null,
      phone: null,
      handle: null,
      url: null,
      name_mentions: [],
    };
    const response = await api.createComplaint({
      session_id: sessionId,
      description: draftDescription || "Reported via Golden Hour.",
      location: { state: "Delhi", district: "New Delhi", pincode: "110001" },
      fraud_type: "money_movement_fraud",
      payment_method:
        draftPaymentMethod && draftPaymentMethod !== "auto"
          ? draftPaymentMethod
          : "upi",
      amount: extractedFacts?.amount ?? 0,
      incident_at: effectiveIncidentAt,
      pipeline: routing.pipeline as Pipeline,
      routing_confidence: routing.confidence,
      routing_reasoning: routing.reasoning,
      golden_hour_remaining_seconds: routing.golden_hour_remaining_seconds,
      facts,
    });
    setComplaint(response);
    return response;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!reference.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const c = await ensureComplaint();
      const result = await api.recordHelplineReference(c.id, reference.trim());
      setHelplineReference(result.helpline_reference_number);
      setAcknowledged(true);
      toast.success("Reference saved. Opening complaint package…");
      onSubmitted?.(c);
      setTimeout(() => router.push(`/documents?caseId=${c.id}`), 1500);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? `${error.message}: ${JSON.stringify(error.detail)}`
          : error instanceof Error
            ? error.message
            : "Failed to record reference.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card data-print="surface">
      <CardHeader>
        <CardTitle>After the call</CardTitle>
        <CardDescription>
          Save the helpline reference number — it gets attached to your NCRP
          and bank dispute drafts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="reference">Helpline reference number</FieldLabel>
            <Input
              id="reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="e.g. 1930REF0001"
              className="font-mono"
              required
              autoComplete="off"
            />
            <FieldDescription>
              Without this we can still file, but the case will not be linked
              to the 1930 call.
            </FieldDescription>
          </Field>
          <Button
            type="submit"
            size="lg"
            disabled={submitting || !reference.trim() || acknowledged}
            className="w-full"
          >
            <ShieldCheck aria-hidden />
            {acknowledged
              ? "Saved. Loading complaint package…"
              : submitting
                ? "Saving…"
                : "Save reference and continue"}
          </Button>
          {acknowledged ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <CircleCheck className="size-3.5" aria-hidden /> Reference saved.
            </p>
          ) : null}
          {lastError ? (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertTitle>Couldn&apos;t save the reference</AlertTitle>
              <AlertDescription>{lastError}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
