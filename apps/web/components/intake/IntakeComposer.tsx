"use client";

/**
 * IntakeComposer — premium emergency command surface for the home page.
 *
 * Pack §6 / image 01:
 *   - page title "What happened?" with a calm description
 *   - one big textarea (always visible, dominant input)
 *   - four method cards (Write, SMS, Screenshot, Voice) below the textarea
 *   - examples chips for scripted scenarios
 *   - dominant Route action
 *   - official helplines card (aside)
 *   - routing result + audit trail card (aside)
 *
 * Mobile-first. Uses shadcn primitives, lucide icons, and the new sky
 * glass palette. Sensitive values (Aadhaar, PAN, OTP, full card) are
 * redacted before any persistence; the form only sees user-pasted text.
 */
import { useCallback, useEffect, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Mic,
  Receipt,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

import { api, ApiError } from "@/lib/api";
import { useWorkflowStore } from "@/lib/workflow-store";
import type {
  IntakeRequest,
  IntakeResponse,
  Pipeline,
} from "@/lib/types";

import { CaseSummaryCard } from "@/components/app/CaseSummaryCard";
import { EmptyState } from "@/components/app/EmptyState";
import { GlassPanel } from "@/components/app/GlassPanel";
import { PageHeader } from "@/components/app/PageHeader";
import { PrivacyNotice } from "@/components/app/PrivacyNotice";
import { StatusBadge } from "@/components/app/StatusBadge";
import { cn } from "@/lib/utils";

const SAMPLE_GOOGLE_PAY_SMS =
  "Google Pay txn alert: Rs 2,500.00 paid to scammer.fraud@upi. " +
  "UTR 408722195166. Transaction ID 408722195166. Sender SBI A/c ****4521. " +
  "If not done by you call 1930 immediately.";

type Scenario = {
  id: string;
  label: string;
  description: string;
  amount?: number;
  minutesAgo?: number;
  paymentMethod?: string;
  evidence?: string;
  isPrimary?: boolean;
};

const SAMPLE_SCENARIOS: ReadonlyArray<Scenario> = [
  {
    id: "priya",
    label: "Priya: hostel warden UPI scam",
    description:
      "Mujhe lag raha tha warden hai. Usne bola fees bharo Google Pay se. Maine bhar diya. Ab number band hai.",
    amount: 2500,
    minutesAgo: 15,
    paymentMethod: "upi",
    evidence: SAMPLE_GOOGLE_PAY_SMS,
    isPrimary: true,
  },
  {
    id: "sextortion",
    label: "Sextortion + UPI demand",
    description:
      "Someone I met online is threatening to share a private video. They are demanding Rs 8000 to scammer.fraud@upi.",
    paymentMethod: "upi",
  },
  {
    id: "job_scam",
    label: "Job scam with multiple payments",
    description:
      "I was offered a part-time job and asked to pay a registration fee of Rs 1500 to job.fees@upi, then Rs 3000 for a training kit. Now the recruiter is silent.",
  },
  {
    id: "account_hack",
    label: "Account hack, money unclear",
    description:
      "My Instagram account was hacked. I cannot login. I am not sure if any money was taken from my linked bank account.",
  },
  {
    id: "post_phish",
    label: "Phishing after refund call",
    description:
      "I received a call claiming a refund was pending. I clicked a link, refund-claim.in, and entered card details. Lost Rs 4200 yesterday.",
    amount: 4200,
    minutesAgo: 60 * 6,
    paymentMethod: "card",
    evidence:
      "HDFC Bank: Rs 4,200.00 debited from a/c ****8821 on 04-Jun-2026 06:14 AM IST. " +
      "Txn ID HDFC0A422118. To 4199-VISA-MERCHANT. If unauthorised call 1800-202-6161.",
  },
];

const PIPELINE_LABEL: Record<Pipeline, string> = {
  golden_hour: "Golden Hour",
  post_golden_hour: "Post Golden Hour",
  fall_back: "Guided Fall-Back",
};

const PIPELINE_HINT: Record<Pipeline, string> = {
  golden_hour:
    "Reporting quickly may improve fund-blocking chances. The helpline is the next step.",
  post_golden_hour:
    "Past the 60-minute window. We will build the complaint package and bank dispute email.",
  fall_back:
    "We need a few quick answers to route you correctly. You stay in control.",
};

const OFFICIAL_HELPLINES = [
  { label: "Cybercrime", number: "1930", detail: "cybercrime.gov.in" },
  { label: "Police / ERSS", number: "112", detail: "112.gov.in" },
  { label: "Women helpline", number: "181", detail: "Sakhi" },
];

type MethodId = "write" | "sms" | "screenshot" | "voice";

const METHOD_CARDS: ReadonlyArray<{
  id: MethodId;
  label: string;
  description: string;
  icon: typeof FileText;
}> = [
  {
    id: "write",
    label: "Write or type",
    description: "Describe in your own words",
    icon: FileText,
  },
  {
    id: "sms",
    label: "Paste an SMS",
    description: "Bank or wallet alert",
    icon: MessageSquare,
  },
  {
    id: "screenshot",
    label: "Upload a screenshot",
    description: "We read only the text",
    icon: ImageIcon,
  },
  {
    id: "voice",
    label: "Voice (stub)",
    description: "Speak if you can",
    icon: Mic,
  },
];

export function IntakeComposer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    sessionId,
    setSession,
    setRouting,
    setError,
    setDraft,
    draftDescription,
    draftEvidence,
    ensureSession,
    lastError,
  } = useWorkflowStore();

  const [description, setDescription] = useState(draftDescription);
  const [evidenceText, setEvidenceText] = useState(draftEvidence);
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("auto");
  const [minutesAgo, setMinutesAgo] = useState<string>("");
  const [isListening, setIsListening] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<IntakeResponse | null>(null);
  const [activeMethod, setActiveMethod] = useState<MethodId>("write");

  useEffect(() => {
    if (!sessionId) {
      void ensureSession().then(setSession).catch(() => undefined);
    }
  }, [sessionId, ensureSession, setSession]);

  useEffect(() => {
    const numericAmount = amount ? Number.parseFloat(amount) : null;
    const incidentIso = computeIncidentAtIso(minutesAgo);
    setDraft(description, evidenceText, numericAmount, paymentMethod, incidentIso);
  }, [description, evidenceText, amount, paymentMethod, minutesAgo, setDraft]);

  const applyScenario = useCallback((scenario: Scenario) => {
    setDescription(scenario.description);
    setAmount(scenario.amount?.toString() ?? "");
    setMinutesAgo(scenario.minutesAgo?.toString() ?? "");
    setPaymentMethod(scenario.paymentMethod ?? "auto");
    if (scenario.evidence) {
      setEvidenceText(scenario.evidence);
    }
    setActiveMethod("write");
    setResult(null);
  }, []);

  useEffect(() => {
    const scenarioId = searchParams.get("scenario");
    if (!scenarioId) return;
    const scenario = SAMPLE_SCENARIOS.find((item) => item.id === scenarioId);
    if (!scenario) return;
    void (() => {
      applyScenario(scenario);
      window.history.replaceState(null, "", window.location.pathname);
    })();
  }, [applyScenario, searchParams]);

  function useSampleGPaySms() {
    setEvidenceText(SAMPLE_GOOGLE_PAY_SMS);
    if (!amount) setAmount("2500");
    if (!minutesAgo) setMinutesAgo("15");
    if (!paymentMethod || paymentMethod === "auto") setPaymentMethod("upi");
    setActiveMethod("sms");
    toast.success("Sample GPay SMS pasted");
  }

  function computeIncidentAtIso(minutesAgoRaw: string): string | null {
    if (!minutesAgoRaw) return null;
    const minutes = Number.parseInt(minutesAgoRaw, 10);
    if (Number.isNaN(minutes) || minutes < 0) return null;
    return new Date(Date.now() - minutes * 60_000).toISOString();
  }

  function incidentAtIso(): string | null {
    return computeIncidentAtIso(minutesAgo);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!description.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const sid = await ensureSession();
      const payload: IntakeRequest = {
        description,
        evidence_text: evidenceText || null,
        incident_at: incidentAtIso(),
        amount: amount ? Number.parseFloat(amount) : null,
        payment_method: paymentMethod,
        location: null,
        contact_channel: "web",
        preferred_language: "en",
        extra_pasted_sms: null,
      };
      const response = await api.classify(sid, payload);
      setResult(response);
      setRouting(response.routing, response.extracted_facts);
      toast.success(`Routed to ${PIPELINE_LABEL[response.routing.pipeline]}`);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? `${error.message}: ${JSON.stringify(error.detail)}`
          : error instanceof Error
            ? error.message
            : "Something went wrong while routing your request.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function continueToNext() {
    if (!result) return;
    const pipeline = result.routing.pipeline;
    if (pipeline === "golden_hour") {
      void router.push("/emergency");
    } else if (pipeline === "post_golden_hour") {
      void router.push("/documents");
    } else {
      void router.push("/fall-back");
    }
  }

  const primaryScenario = SAMPLE_SCENARIOS.find((s) => s.isPrimary);
  const otherScenarios = SAMPLE_SCENARIOS.filter((s) => !s.isPrimary);

  const currentStep = result ? 3 : 1;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-7">
      <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <PageHeader
          title="What happened?"
          description="Describe the incident in your own words. Our AI will guide you to the right steps."
        />
        <CompactProgress currentStep={currentStep} />
      </div>

      <div
        className={cn(
          "grid min-w-0 gap-6",
          result ? "lg:grid-cols-[1.2fr_0.8fr]" : "lg:grid-cols-1",
        )}
      >
        <div className="flex min-w-0 flex-col gap-5">
          <GlassPanel variant="strong" className="overflow-hidden rounded-xl p-5 sm:p-8">
            <form className="flex flex-col gap-7" onSubmit={handleSubmit} noValidate>
              <div className="relative flex flex-col">
                <Textarea
                  id="description"
                  required
                  rows={8}
                  placeholder="Type or speak to describe the incident..."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-[220px] resize-none rounded-xl border-white/70 bg-white/58 px-6 py-6 pb-20 text-base leading-relaxed text-ink-900 shadow-glass-soft placeholder:text-ink-500/80 focus-visible:ring-sky-400/60 md:text-base"
                  data-testid="intake-description"
                />
                <div className="pointer-events-none absolute inset-x-6 bottom-5 flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-ink-500">
                    {description.length} / 4000
                  </span>
                  <span className="pointer-events-auto flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveMethod("voice")}
                      aria-label="Add voice note"
                      className="inline-flex size-12 items-center justify-center rounded-full bg-white/85 text-sky-700 shadow-glass-soft transition-colors hover:bg-white"
                    >
                      <Mic className="size-5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMethod("screenshot")}
                      aria-label="Attach evidence"
                      className="inline-flex size-12 items-center justify-center rounded-full bg-white/85 text-sky-700 shadow-glass-soft transition-colors hover:bg-white"
                    >
                      <ImageIcon className="size-5" aria-hidden />
                    </button>
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-ink-800">
                  Add details in your way
                </p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {METHOD_CARDS.map((method) => {
                    const Icon = method.icon;
                    const active = activeMethod === method.id;
                    return (
                      <button
                        type="button"
                        key={method.id}
                        onClick={() => setActiveMethod(method.id)}
                        aria-pressed={active}
                        className={cn(
                          "group flex min-h-[118px] items-start gap-4 rounded-xl border bg-white/58 p-5 text-left shadow-glass-soft transition-colors",
                          active
                            ? "border-sky-300/80 bg-white/82 ring-2 ring-sky-300/50"
                            : "border-white/70 hover:border-sky-300/70 hover:bg-white/80",
                        )}
                        data-testid={`method-${method.id}`}
                      >
                        <span
                          className={cn(
                            "inline-flex size-11 shrink-0 items-center justify-center rounded-xl",
                            active
                              ? "bg-sky-600 text-white"
                              : "bg-sky-100/80 text-sky-700",
                          )}
                        >
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-base font-semibold text-ink-900">
                            {method.label}
                          </span>
                          <span className="text-sm leading-5 text-ink-500">
                            {method.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {activeMethod === "sms" ? (
                  <div className="flex flex-col gap-2 rounded-xl border border-sky-100 bg-white/70 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="evidence-sms"
                        className="text-xs font-semibold text-ink-900"
                      >
                        Paste the SMS or chat
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={useSampleGPaySms}
                        data-testid="use-sample-sms"
                      >
                        <Receipt aria-hidden />
                        Use sample GPay SMS
                      </Button>
                    </div>
                    <Textarea
                      id="evidence-sms"
                      rows={4}
                      placeholder="Paste the SMS, WhatsApp message, or email text."
                      value={evidenceText}
                      onChange={(event) => setEvidenceText(event.target.value)}
                      className="border-sky-200/70 bg-white text-sm"
                    />
                    <p className="text-xs text-ink-500">
                      The full SMS — UTR, UPI ID, amount, timestamp — gives the
                      most accurate extraction.
                    </p>
                  </div>
                ) : null}

                {activeMethod === "screenshot" ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-sky-200 bg-white/60 px-4 py-6 text-center">
                    <ImageIcon
                      className="size-6 text-sky-600"
                      aria-hidden
                    />
                    <p className="text-sm text-ink-700">
                      We never read full screenshots in the MVP — only the text
                      you paste below.
                    </p>
                    <Input
                      id="screenshot-upload"
                      type="file"
                      accept="image/*,text/plain"
                      className="max-w-xs cursor-pointer"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const text = await file.text();
                        setEvidenceText(text);
                        setActiveMethod("sms");
                        toast.success("Text extracted from file");
                      }}
                    />
                  </div>
                ) : null}

                {activeMethod === "voice" ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-sky-200 bg-white/60 px-4 py-6 text-center">
                    <Mic
                      className={cn(
                        "size-6",
                        isListening ? "text-emergency" : "text-sky-600",
                      )}
                      aria-hidden
                    />
                    <p className="text-sm text-ink-700">
                      Browser speech recognition is not enabled in the MVP. Tap
                      the button to simulate &quot;listening&quot; and dictate
                      the description manually above.
                    </p>
                    <Button
                      type="button"
                      variant={isListening ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => setIsListening((v) => !v)}
                      aria-pressed={isListening}
                    >
                      {isListening ? "Stop (stub)" : "Start (stub)"}
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="amount">Amount (Rs)</FieldLabel>
                  <Input
                    id="amount"
                    inputMode="decimal"
                    placeholder="2500"
                    className="font-mono"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                  <FieldDescription>Used for the recovery band.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="minutes">Minutes ago</FieldLabel>
                  <Input
                    id="minutes"
                    inputMode="numeric"
                    placeholder="15"
                    className="font-mono"
                    value={minutesAgo}
                    onChange={(event) => setMinutesAgo(event.target.value)}
                  />
                  <FieldDescription>Sets the timer if under 60.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="payment">Payment method</FieldLabel>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="payment">
                      <SelectValue placeholder="Detect from text" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Detect from text</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="netbanking">Netbanking</SelectItem>
                      <SelectItem value="wallet">Wallet</SelectItem>
                      <SelectItem value="none">No money involved</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>Used for the recovery band.</FieldDescription>
                </Field>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink-800">
                    Common examples
                  </p>
                  <p className="hidden text-xs text-ink-500 sm:block">
                    Pick one to prefill the demo.
                  </p>
                </div>
                <div className="scroll-fade-x flex flex-nowrap gap-3 overflow-x-auto pb-1">
                  {primaryScenario ? (
                    <button
                      type="button"
                      data-testid="scenario-priya"
                      data-scenario-id={primaryScenario.id}
                      onClick={() => applyScenario(primaryScenario)}
                      className="inline-flex h-14 shrink-0 items-center gap-3 rounded-[10px] border border-white/75 bg-white/65 px-6 text-sm font-semibold text-ink-800 shadow-glass-soft transition-colors hover:bg-white"
                    >
                      <Receipt className="size-4 text-sky-700" aria-hidden />
                      UPI / Payment Fraud
                    </button>
                  ) : null}
                  {otherScenarios.map((scenario) => (
                    <button
                      key={scenario.id}
                      type="button"
                      data-testid={`scenario-${scenario.id}`}
                      data-scenario-id={scenario.id}
                      onClick={() => applyScenario(scenario)}
                      className="inline-flex h-14 shrink-0 items-center gap-3 rounded-[10px] border border-white/75 bg-white/56 px-6 text-sm font-semibold text-ink-800 shadow-glass-soft transition-colors hover:bg-white"
                    >
                      <WandSparkles className="size-4 text-sky-700" aria-hidden />
                      {scenario.label.replace("Sextortion + UPI demand", "Social Media Harassment").replace("Account hack, money unclear", "Account Hacked")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting || !description.trim()}
                  aria-label="Route to the right flow"
                  className="h-16 w-full rounded-xl bg-sky-600 text-lg font-semibold shadow-glass-strong hover:bg-sky-700"
                  data-testid="route-button"
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <WandSparkles className="size-4" aria-hidden />
                  )}
                  {submitting ? "Routing…" : "Continue to Next Step"}
                  <ChevronRight className="size-5" aria-hidden />
                </Button>
                <p className="text-center text-sm text-ink-500">
                  Your information is safe, secure and confidential.
                </p>
              </div>
            </form>
          </GlassPanel>

          <PrivacyNotice title="Privacy & redaction">
            Aadhaar, PAN, OTPs, full card numbers, and PINs are replaced
            before persistence. We never read full screenshots — only the
            text you paste.
          </PrivacyNotice>

          {lastError ? (
            <Alert variant="destructive">
              <AlertTitle>Routing failed</AlertTitle>
              <AlertDescription>{lastError}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        {result ? (
        <aside className="flex min-w-0 flex-col gap-4">
          <GlassPanel variant="muted" className="p-5">
            <h3 className="text-sm font-semibold text-ink-900">
              Official pathways
            </h3>
            <p className="text-xs text-ink-500">
              Reference guidance only · not a live integration
            </p>
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {OFFICIAL_HELPLINES.map((h) => (
                <li key={h.number}>
                  <a
                    href={`tel:${h.number}`}
                    className="flex h-full flex-col gap-0.5 rounded-xl border border-sky-100 bg-white/80 p-2.5 transition-colors hover:border-sky-300 hover:bg-sky-50"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">
                      {h.label}
                    </span>
                    <span className="font-mono text-lg font-semibold tabular-nums text-ink-900">
                      {h.number}
                    </span>
                    <span className="hidden text-[10px] text-ink-500 sm:inline">
                      {h.detail}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </GlassPanel>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Routing result</CardTitle>
              <CardDescription>
                {result
                  ? "Pipeline selected. Continue to the next surface."
                  : "Submit a description to see the chosen pipeline and audit trail."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result ? (
                <RoutingResult
                  result={result}
                  onContinue={continueToNext}
                  submitting={submitting}
                />
              ) : (
                <EmptyState
                  icon={WandSparkles}
                  title="No routing yet"
                  description="Submit the form to see the chosen pipeline, extracted facts, and audit trail."
                  className="border-0 bg-transparent p-0"
                />
              )}
            </CardContent>
          </Card>
        </aside>
        ) : null}
      </div>
    </div>
  );
}

function CompactProgress({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex w-full max-w-[300px] flex-col gap-3 lg:justify-self-end">
      <div className="inline-flex h-9 w-fit items-center rounded-full border border-sky-200 bg-white/55 px-4 text-sm font-semibold text-sky-700 shadow-glass-soft">
        Step {currentStep} of 5
      </div>
      <div className="flex items-center gap-4">
        {Array.from({ length: 5 }).map((_, index) => {
          const active = index + 1 <= currentStep;
          return (
            <span
              key={index}
              className={cn(
                "h-2 flex-1 rounded-full transition-colors",
                active ? "bg-sky-600" : "bg-sky-200/80",
              )}
              aria-hidden
            />
          );
        })}
      </div>
    </div>
  );
}

function RoutingResult({
  result,
  onContinue,
  submitting,
}: {
  result: IntakeResponse;
  onContinue: () => void;
  submitting: boolean;
}) {
  const { routing, extracted_facts: facts, notes } = result;
  const tone =
    routing.pipeline === "golden_hour"
      ? "emergency"
      : routing.pipeline === "post_golden_hour"
        ? "primary"
        : "saffron";
  const continueLabel =
    routing.pipeline === "golden_hour"
      ? "Open Golden Hour flow"
      : routing.pipeline === "post_golden_hour"
        ? "Build complaint package"
        : "Start Fall-Back guided flow";
  return (
    <div className="flex flex-col gap-4 anim-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={PIPELINE_LABEL[routing.pipeline]} tone={tone} />
        <StatusBadge
          label={`Confidence ${Math.round(routing.confidence * 100)}%`}
          tone="default"
        />
        {routing.golden_hour_remaining_seconds != null ? (
          <StatusBadge
            label={`~${Math.floor(routing.golden_hour_remaining_seconds / 60)}m ${routing.golden_hour_remaining_seconds % 60}s left`}
            tone="saffron"
          />
        ) : null}
      </div>
      <p className="text-sm text-ink-500">{PIPELINE_HINT[routing.pipeline]}</p>
      <Separator />
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-sky-700">
          Why this routing
        </p>
        <ul className="flex flex-col gap-1.5 text-sm text-ink-900">
          {routing.reasoning.map((line, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-sky-600" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
      <CaseSummaryCard
        title="Extracted facts"
        description="Aadhaar, PAN, OTPs are redacted."
        facts={[
          { label: "UPI ID", value: facts.upi_id, mono: true },
          {
            label: "Amount",
            value:
              facts.amount != null
                ? `Rs ${facts.amount.toLocaleString("en-IN")}`
                : null,
          },
          { label: "UTR / reference", value: facts.utr, mono: true },
          { label: "Bank", value: facts.bank },
          { label: "Payment app", value: facts.payment_app },
          { label: "Phone", value: facts.phone, mono: true },
          { label: "Handle", value: facts.handle, mono: true },
          { label: "URL", value: facts.url, mono: true },
        ]}
      />
      {notes.length > 0 ? (
        <Alert>
          <Sparkles aria-hidden />
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>
            <ul className="flex flex-col gap-1.5">
              {notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      <Button
        type="button"
        size="lg"
        variant={routing.pipeline === "golden_hour" ? "destructive" : "default"}
        onClick={onContinue}
        disabled={submitting}
        className="w-full rounded-full"
      >
        {continueLabel}
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
