"use client";

/**
 * Fall-Back guided flow.
 *
 * Three scripted edge cases from AGENTS.md: sextortion + UPI demand,
 * job scam with multiple payments, and account hack with uncertain
 * financial loss. The flow asks short clarifying questions, then routes
 * to the appropriate pipeline (post-golden-hour or golden-hour) and
 * provides next steps.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Hand,
  HandHelping,
  LifeBuoy,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { WorkflowStepper } from "@/components/app/WorkflowStepper";

import { api, ApiError } from "@/lib/api";
import { useWorkflowStore } from "@/lib/workflow-store";
import type { FallBackQuestion, FallBackTurnResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const SAFETY_TIPS_BY_CASE: Record<string, string[]> = {
  sextortion: [
    "You are not alone. Many people face this kind of threat and survive it.",
    "Do not pay more money to make the threat stop. It rarely works and often invites more demands.",
    "Block the scammer on every platform they used to contact you.",
    "Save screenshots of every chat, including the threat and any UPI / payment requests.",
    "Do not delete the chats. We will route you to a complaint path that protects your evidence.",
  ],
  job_scam: [
    "Real employers never ask for a registration or training fee.",
    "Stop any further payments. The scammer will keep asking for more.",
    "Preserve the original job offer message, the recruiter's handle, and every UPI / wallet reference.",
    "We will route you to a complaint path so you can build a bank dispute email and an NCRP draft.",
  ],
  account_hack: [
    "Change passwords for any other account that uses the same password.",
    "Enable two-factor authentication on your email and phone number first.",
    "If any money was taken, treat this as financial fraud and we will route to the post-golden-hour path.",
    "If no money was taken, we will route to a complaint and account-recovery checklist.",
  ],
  generic: [
    "Take a breath. We are here to help you take the next concrete step.",
    "If you have any screenshots or messages from the scammer, save them now.",
    "We will ask a few short questions to route you correctly.",
  ],
};

function tipsForQuestion(q: FallBackQuestion | undefined): string[] {
  if (!q) return SAFETY_TIPS_BY_CASE.generic;
  if (q.id.includes("threat") || q.id.includes("sextort")) {
    return SAFETY_TIPS_BY_CASE.sextortion;
  }
  if (q.id.includes("job") || q.id.includes("employer")) {
    return SAFETY_TIPS_BY_CASE.job_scam;
  }
  if (q.id.includes("hack") || q.id.includes("account")) {
    return SAFETY_TIPS_BY_CASE.account_hack;
  }
  return SAFETY_TIPS_BY_CASE.generic;
}

export function FallBackClient() {
  const router = useRouter();
  const {
    draftDescription,
    draftEvidence,
    setError,
    setRouting,
    lastError,
  } = useWorkflowStore();
  const [state, setState] = useState<FallBackTurnResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [description, setDescription] = useState(draftDescription);
  const [evidenceText, setEvidenceText] = useState(draftEvidence);
  const [submitting, setSubmitting] = useState(false);
  const [started, setStarted] = useState(false);
  const [complete, setComplete] = useState(false);

  async function startFlow() {
    if (!description.trim()) {
      setError("Please describe what happened before we can help.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await api.startFallBack(description, evidenceText);
      setState(response);
      setStarted(true);
      if (
        response.current_step === "complete" ||
        (response.routing.pipeline !== "fall_back" &&
          response.next_questions.length === 0)
      ) {
        setComplete(true);
        setRouting(response.routing, response.extracted_facts);
      }
    } catch (error) {
      const message =
        error instanceof ApiError
          ? `${error.message}: ${JSON.stringify(error.detail)}`
          : error instanceof Error
            ? error.message
            : "Failed to start the Fall-Back flow.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAnswers() {
    if (!state) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await api.advanceFallBack({
        case_id: state.case_id,
        answers,
        description,
        evidence_text: evidenceText,
      });
      setState(response);
      setAnswers({});
      if (
        response.current_step === "complete" ||
        (response.routing.pipeline !== "fall_back" &&
          response.next_questions.length === 0)
      ) {
        setComplete(true);
        setRouting(response.routing, response.extracted_facts);
      }
    } catch (error) {
      const message =
        error instanceof ApiError
          ? `${error.message}: ${JSON.stringify(error.detail)}`
          : error instanceof Error
            ? error.message
            : "Failed to advance the Fall-Back flow.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!started) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeader
          eyebrow={
            <span className="inline-flex items-center gap-2 text-saffron-600">
              <LifeBuoy className="size-3.5" aria-hidden /> Fall-Back guided flow
            </span>
          }
          title="We will ask a few short questions, then route you to the next step."
          description="This is a calm, supportive flow for cases that do not fit the standard routes. We never share your data, and we will not ask you to pay anything."
        />
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-0.5">
              <CardTitle>Tell us what happened</CardTitle>
              <CardDescription>
                Use any language. We will redact sensitive values before
                saving.
              </CardDescription>
            </div>
            <StatusBadge label="Confidential" tone="muted" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">What happened?</Label>
              <Textarea
                id="description"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="A short description in any language."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="evidence">Paste messages or screenshots (optional)</Label>
              <Textarea
                id="evidence"
                rows={3}
                value={evidenceText}
                onChange={(event) => setEvidenceText(event.target.value)}
                placeholder="Paste any messages, or describe what was in the screenshot."
              />
            </div>
            <Button
              onClick={startFlow}
              disabled={submitting || !description.trim()}
              className="w-full"
            >
              {submitting ? (
                <>
                  <Skeleton className="size-3.5 rounded-full" /> Starting…
                </>
              ) : (
                <>
                  <Hand className="size-3.5" aria-hidden /> Start guided flow
                </>
              )}
            </Button>
            {lastError ? (
              <Alert variant="destructive">
                <TriangleAlert aria-hidden />
                <AlertTitle>Fall-Back flow</AlertTitle>
                <AlertDescription>{lastError}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (complete && state) {
    const isGolden = state.routing.pipeline === "golden_hour";
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeader
          eyebrow={
            <span className="inline-flex items-center gap-2 text-success-500">
              <ShieldCheck className="size-3.5" aria-hidden /> Rerouted
            </span>
          }
          title="We have enough to take you to the next step."
          description={
            <>
              Based on your answers we are routing you to the{" "}
              <span className="font-semibold text-foreground">
                {isGolden ? "Golden Hour" : "Post Golden Hour"}
              </span>{" "}
              flow. Reporting quickly may improve fund-blocking chances.
            </>
          }
        />
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-0.5">
              <CardTitle>Why this routing</CardTitle>
              <CardDescription>
                Reasoning from the deterministic intake engine
              </CardDescription>
            </div>
            <StatusBadge
              label={isGolden ? "Golden Hour" : "Post Golden Hour"}
              tone={isGolden ? "emergency" : "primary"}
            />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2 text-sm text-foreground">
              {state.routing.reasoning.map((line, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              {isGolden ? (
                <Button
                  variant="destructive"
                  onClick={() => router.push("/emergency")}
                >
                  <HandHelping className="size-3.5" aria-hidden />
                  Open Golden Hour flow
                  <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              ) : (
                <Button onClick={() => router.push("/documents")}>
                  Build complaint package
                  <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              )}
              <Button variant="outline" onClick={() => router.push("/")}>
                Back to intake
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!state) return null;

  const totalQuestions = state.next_questions.length;
  const tips = tipsForQuestion(state.next_questions[0]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2 text-saffron-600">
            <LifeBuoy className="size-3.5" aria-hidden /> Guided questions
          </span>
        }
        title="A few short questions"
        description="Answer as best you can. Leave any question blank if it does not apply. Your answers stay in your browser."
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-0.5">
            <CardTitle>Safety reminders</CardTitle>
            <CardDescription>
              Contextual tips based on what you described
            </CardDescription>
          </div>
          <StatusBadge label="Read before continuing" tone="saffron" />
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm text-foreground">
            {tips.map((tip) => (
              <li key={tip} className="flex items-start gap-2">
                <span className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-saffron-500" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {state.notes.length > 0 ? (
        <Card>
          <CardContent className="pt-4 text-sm text-foreground">
            {state.notes.map((note, idx) => (
              <p key={idx}>{note}</p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {totalQuestions > 0 ? (
        <div>
          <WorkflowStepper
            steps={state.next_questions.map((q, idx) => ({
              id: q.id,
              label: `Q${idx + 1}`,
              state: idx === 0 ? ("active" as const) : ("pending" as const),
            }))}
          />
          <div className="mt-3 flex flex-col gap-3">
            {state.next_questions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                value={answers[q.id] ?? ""}
                onChange={(value) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: value }))
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={submitAnswers}
          disabled={submitting || Object.keys(answers).length === 0}
        >
          {submitting ? "Submitting…" : "Submit answers"}
        </Button>
        <Button variant="ghost" onClick={() => router.push("/")}>
          Cancel
        </Button>
        <Badge variant="secondary" className="ml-auto rounded-full">
          {Object.keys(answers).length} of {totalQuestions} answered
        </Badge>
      </div>

      {lastError ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertTitle>Fall-Back flow</AlertTitle>
          <AlertDescription>{lastError}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function QuestionCard({
  question,
  value,
  onChange,
}: {
  question: FallBackQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{question.prompt}</CardTitle>
        <CardDescription>Choose the closest match</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2">
          {question.options.map((option) => {
            const checked = value === option;
            return (
              <label
                key={option}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm transition-colors",
                  checked
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted/30",
                )}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={checked}
                  onChange={() => onChange(option)}
                  className="mt-0.5 size-4 accent-[hsl(var(--primary))]"
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
