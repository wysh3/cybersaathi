"use client";

/**
 * ChatIntakeComposer — premium conversational emergency intake.
 *
 * Adapts the original IntakeComposer's polished glass-panel design language
 * into a conversational chat flow. The chat sits inside the same premium
 * glass surface, with method cards for evidence, demo scenario chips,
 * live fact extraction sidebar, routing audit trail, and golden-hour timer.
 *
 * Mobile-first. Uses shadcn primitives, lucide icons, sky glass palette.
 */
import { useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Mic,
  Receipt,
  Send,
  Shield,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

import { api } from "@/lib/api";
import { useWorkflowStore } from "@/lib/workflow-store";
import { cn } from "@/lib/utils";
import type {
  CaseStateSnapshot,
  ChatMessage,
  Pipeline,
} from "@/lib/types";

import { CaseSummaryCard } from "@/components/app/CaseSummaryCard";
import { GlassPanel } from "@/components/app/GlassPanel";
import { PageHeader } from "@/components/app/PageHeader";
import { PrivacyNotice } from "@/components/app/PrivacyNotice";
import { StatusBadge } from "@/components/app/StatusBadge";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAMPLE_GOOGLE_PAY_SMS =
  "Google Pay txn alert: Rs 2,500.00 paid to scammer.fraud@upi. " +
  "UTR 408722195166. Transaction ID 408722195166. Sender SBI A/c ****4521. " +
  "If not done by you call 1930 immediately.";

type Scenario = {
  id: string;
  label: string;
  description: string;
  amount?: number;
  paymentMethod?: string;
  evidence?: string;
  isPrimary?: boolean;
};

const SAMPLE_SCENARIOS: ReadonlyArray<Scenario> = [
  {
    id: "priya",
    label: "UPI / Payment Fraud",
    description:
      "Mujhe lag raha tha warden hai. Usne bola fees bharo Google Pay se. Maine bhar diya Rs 2500 scammer.fraud@upi ko. Ab number band hai. 15 minutes ago hua.",
    amount: 2500,
    paymentMethod: "upi",
    evidence: SAMPLE_GOOGLE_PAY_SMS,
    isPrimary: true,
  },
  {
    id: "sextortion",
    label: "Social Media Harassment",
    description:
      "Someone I met online is threatening to share a private video. They are demanding Rs 8000 to scammer.fraud@upi.",
    paymentMethod: "upi",
  },
  {
    id: "job_scam",
    label: "Job Scam",
    description:
      "I was offered a part-time job and asked to pay a registration fee of Rs 1500 then Rs 3000 for training. Now the recruiter is silent.",
  },
  {
    id: "account_hack",
    label: "Account Hacked",
    description:
      "My Instagram account was hacked. I cannot login. I am not sure if any money was taken from my linked bank account.",
  },
  {
    id: "post_phish",
    label: "Phishing Scam",
    description:
      "I received a call claiming a refund was pending. I clicked a link and entered card details. Lost Rs 4200 yesterday.",
    amount: 4200,
    paymentMethod: "card",
    evidence:
      "HDFC Bank: Rs 4,200.00 debited from a/c ****8821 on 04-Jun-2026. " +
      "If unauthorised call 1800-202-6161.",
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
  { id: "write", label: "Write or type", description: "Describe in your own words", icon: FileText },
  { id: "sms", label: "Paste an SMS", description: "Bank or wallet alert", icon: MessageSquare },
  { id: "screenshot", label: "Upload a screenshot", description: "We read only the text", icon: ImageIcon },
  { id: "voice", label: "Voice (stub)", description: "Speak if you can", icon: Mic },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatIntakeComposer() {
  const router = useRouter();
  const {
    conversationId,
    caseSnapshot,
    chatMessages,
    setConversation,
    appendChatMessages,
    setCaseSnapshot,
    setComplaint,
    setRouting,
    setError,
    lastError,
  } = useWorkflowStore();

  const [input, setInput] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  const [activeMethod, setActiveMethod] = useState<MethodId>("write");
  const [isListening, setIsListening] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showEvidencePanel, setShowEvidencePanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdCounter = useRef(0);

  // Derived state
  const hasMessages = chatMessages.length > 1;
  const routing = caseSnapshot?.routing;
  const pipeline = (routing?.pipeline || "fall_back") as Pipeline;
  const canConfirm =
    caseSnapshot?.next_action === "confirm_facts";
  const currentStep = canConfirm ? 4 : hasMessages ? 2 : 1;

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Start conversation
  async function startConversationFn() {
    try {
      const response = await api.startIntakeChat();
      setConversation(response.conversation_id, response.case_snapshot);
      appendChatMessages([response.message]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to start chat";
      setError(msg);
      toast.error(msg);
    }
  }

  useEffect(() => {
    if (!conversationId) {
      startConversationFn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  async function sendMessage() {
    const text = input.trim();
    if (!text || !conversationId) return;
    setSubmitting(true);
    setError(null);

    const msgId = `local-${++messageIdCounter.current}`;
    const userMsg: ChatMessage = {
      id: msgId,
      conversation_id: conversationId,
      role: "user",
      content_redacted: text,
      message_kind: "chat",
      metadata: {},
      created_at: new Date().toISOString(),
    };
    appendChatMessages([userMsg]);

    const sentInput = text;
    const sentEvidence = showEvidencePanel ? evidenceText : null;
    setInput("");
    if (showEvidencePanel) {
      setEvidenceText("");
      setShowEvidencePanel(false);
      setActiveMethod("write");
    }

    try {
      const response = await api.sendIntakeChatTurn(conversationId, {
        message: sentInput,
        evidence_text: sentEvidence,
      });
      appendChatMessages([response.assistant_message]);
      setCaseSnapshot(response.case_snapshot);
      if (response.routing) {
        setRouting(
          {
            pipeline: response.routing.pipeline as Pipeline,
            confidence: response.routing.confidence || 0,
            reasoning: [],
            golden_hour_remaining_seconds:
              response.routing.golden_hour_remaining_seconds || null,
            is_financial: response.routing.is_financial || false,
          },
          {
            utr: response.case_snapshot.facts?.utr || null,
            upi_id: response.case_snapshot.facts?.upi_id || null,
            amount: response.case_snapshot.facts?.amount || null,
            timestamp: response.case_snapshot.facts?.timestamp || null,
            bank: response.case_snapshot.facts?.bank || null,
            payment_app: response.case_snapshot.facts?.payment_app || null,
            phone: response.case_snapshot.facts?.phone || null,
            handle: response.case_snapshot.facts?.handle || null,
            url: response.case_snapshot.facts?.url || null,
            name_mentions: response.case_snapshot.facts?.name_mentions || [],
          },
        );
      }
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to process message";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmFacts() {
    if (!conversationId || !caseSnapshot) return;
    setConfirming(true);
    setError(null);

    try {
      const response = await api.confirmIntakeChat(conversationId, {
        confirmed_snapshot: caseSnapshot,
        location: {
          state: caseSnapshot.location?.state || "Karnataka",
          district: caseSnapshot.location?.district || "Bengaluru Urban",
          pincode: caseSnapshot.location?.pincode || "560001",
        },
      });

      const responseComplaintId =
        typeof response.complaint?.id === "string"
          ? response.complaint.id
          : null;

      if (response.complaint) {
        const c = response.complaint as Record<string, unknown>;
        setComplaint({
          id: String(c.id || ""),
          fraud_type: String(c.fraud_type || "platform_content_suspect") as import("@/lib/types").FraudType,
          payment_method: String(c.payment_method || "upi") as import("@/lib/types").PaymentMethod,
          amount: Number(c.amount) || 0,
          amount_currency: "INR",
          severity: "medium" as import("@/lib/types").Severity,
          urgency_score: 50,
          pipeline: String(c.pipeline || "post_golden_hour") as Pipeline,
          status: "intake_in_progress",
          location: { state: "Karnataka", district: "Bengaluru Urban" },
          created_at: new Date().toISOString(),
          incident_at: new Date().toISOString(),
          is_resolved: false,
          has_fir: false,
          victim_session_id: "",
          summary: "",
          identifier_ids: [],
          evidence_item_ids: [],
          helpline_reference_number: null,
          cluster_id: null,
        });
      }

      if (response.routing) {
        setRouting(
          {
            pipeline: response.routing.pipeline as Pipeline,
            confidence: response.routing.confidence || 0,
            reasoning: ["Confirmed from conversational intake"],
            golden_hour_remaining_seconds:
              response.routing.golden_hour_remaining_seconds || null,
            is_financial: response.routing.is_financial || false,
          },
          {
            utr: caseSnapshot.facts?.utr || null,
            upi_id: caseSnapshot.facts?.upi_id || null,
            amount: caseSnapshot.facts?.amount || caseSnapshot.amount || null,
            timestamp: caseSnapshot.incident_at || caseSnapshot.facts?.timestamp || null,
            bank: caseSnapshot.facts?.bank || null,
            payment_app: caseSnapshot.facts?.payment_app || null,
            phone: caseSnapshot.facts?.phone || null,
            handle: caseSnapshot.facts?.handle || null,
            url: caseSnapshot.facts?.url || null,
            name_mentions: caseSnapshot.facts?.name_mentions || [],
          },
        );
      }

      const navAction = response.ui_actions.find((a) => a.type === "navigate");
      if (navAction?.target) {
        const target = withCaseId(navAction.target, responseComplaintId);
        toast.success("Complaint created — navigating to next step");
        router.push(target);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to confirm";
      setError(msg);
      toast.error(msg);
    } finally {
      setConfirming(false);
    }
  }

  function applyScenario(scenario: Scenario) {
    setInput(scenario.description);
    if (scenario.evidence) {
      setEvidenceText(scenario.evidence);
      setActiveMethod("sms");
      setShowEvidencePanel(true);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function useSampleGPaySms() {
    setEvidenceText(SAMPLE_GOOGLE_PAY_SMS);
    setShowEvidencePanel(true);
    setActiveMethod("sms");
    toast.success("Sample GPay SMS pasted");
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const primaryScenario = SAMPLE_SCENARIOS.find((s) => s.isPrimary);
  const otherScenarios = SAMPLE_SCENARIOS.filter((s) => !s.isPrimary);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-7">
      {/* ---- Header Row ---- */}
      <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <PageHeader
          eyebrow={
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-3" aria-hidden />
              Emergency intake
            </span>
          }
          title="What happened?"
          description="Describe the incident in your own words. Our AI will guide you to the right steps."
        />
        <CompactProgress currentStep={currentStep} />
      </div>

      {/* ---- Main Content ---- */}
      <div
        className={cn(
          "grid min-w-0 gap-6",
          hasMessages
            ? "lg:grid-cols-[1.2fr_0.8fr]"
            : "lg:grid-cols-1",
        )}
      >
        {/* ======== LEFT: Chat Panel ======== */}
        <div className="flex min-w-0 flex-col gap-5">
          <GlassPanel
            variant="strong"
            className="flex flex-col overflow-hidden rounded-[32px]"
          >
            {/* --- Messages area --- */}
            <div className="flex min-h-[420px] flex-1 flex-col gap-4 overflow-y-auto px-5 py-6 sm:px-8">
              {chatMessages.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-sky-500" />
                </div>
              ) : (
                <>
                  {chatMessages.map((msg, i) => (
                    <ChatBubble key={msg.id || i} msg={msg} />
                  ))}

                  {submitting && (
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 shadow-glass-soft">
                        <Shield className="size-3.5" />
                      </span>
                      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-white/85 px-5 py-4 shadow-glass-soft">
                        <Loader2 className="size-4 animate-spin text-sky-500" />
                        <span className="text-sm text-ink-500">Thinking…</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* --- Evidence panel (shown when method=sms or screenshot is active) --- */}
            {showEvidencePanel && (
              <div className="border-t border-sky-100/60 bg-white/50 px-5 pb-4 pt-4 sm:px-8">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {activeMethod === "sms" ? (
                      <MessageSquare className="size-4 text-sky-600" />
                    ) : (
                      <ImageIcon className="size-4 text-sky-600" />
                    )}
                    <span className="text-xs font-semibold text-ink-700">
                      {activeMethod === "sms"
                        ? "Pasted evidence"
                        : "Uploaded file"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeMethod === "sms" && !evidenceText && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={useSampleGPaySms}
                      >
                        <Receipt aria-hidden className="size-3.5" />
                        <span className="ml-1 text-xs">Use sample GPay SMS</span>
                      </Button>
                    )}
                    <button
                      onClick={() => {
                        setEvidenceText("");
                        setShowEvidencePanel(false);
                        setActiveMethod("write");
                      }}
                      className="inline-flex size-7 items-center justify-center rounded-full bg-ink-100/50 text-ink-500 transition-colors hover:bg-ink-200/50"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>

                {activeMethod === "sms" ? (
                  <Textarea
                    rows={4}
                    placeholder="Paste the SMS, WhatsApp message, or email text here."
                    value={evidenceText}
                    onChange={(e) => setEvidenceText(e.target.value)}
                    className="border-sky-200/70 bg-white text-sm"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-sky-200 bg-white/60 px-4 py-6 text-center">
                    <ImageIcon className="size-6 text-sky-600" aria-hidden />
                    <p className="text-sm text-ink-700">
                      We never read images — paste the text below or type it.
                    </p>
                    <Input
                      type="file"
                      accept="image/*,text/plain"
                      className="max-w-xs cursor-pointer"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const text = await file.text();
                        setEvidenceText(text);
                        setActiveMethod("sms");
                        toast.success("Text extracted from file");
                      }}
                    />
                  </div>
                )}

                {activeMethod === "sms" ? (
                  <p className="mt-2 text-xs text-ink-500">
                    The full SMS — UTR, UPI ID, amount, timestamp — gives the
                    most accurate extraction.
                  </p>
                ) : null}
              </div>
            )}

            {/* --- Input area --- */}
            <div className="border-t border-sky-100/60 bg-white/50 px-5 pb-5 pt-4 sm:px-8">
              {/* Method cards */}
              <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {METHOD_CARDS.map((method) => {
                  const Icon = method.icon;
                  const active = activeMethod === method.id;
                  return (
                    <button
                      type="button"
                      key={method.id}
                      onClick={() => {
                        setActiveMethod(method.id);
                        if (method.id === "sms") setShowEvidencePanel(true);
                        if (method.id === "screenshot") setShowEvidencePanel(true);
                        if (method.id === "voice") {
                          setIsListening(!isListening);
                          toast.info("Voice input is a stub in the MVP");
                        }
                        if (method.id === "write") setShowEvidencePanel(false);
                      }}
                      aria-pressed={active}
                      className={cn(
                        "group flex items-center gap-3 rounded-[18px] border px-4 py-3 text-left transition-colors",
                        active
                          ? "border-sky-300/80 bg-white/82 ring-2 ring-sky-300/50 shadow-glass-soft"
                          : "border-white/70 bg-white/58 hover:border-sky-300/70 hover:bg-white/80 shadow-glass-soft",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex size-9 shrink-0 items-center justify-center rounded-xl",
                          active
                            ? "bg-sky-600 text-white"
                            : "bg-sky-100/80 text-sky-700",
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-semibold text-ink-900">
                          {method.label}
                        </span>
                        <span className="hidden text-xs leading-5 text-ink-500 sm:block">
                          {method.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Voice stub */}
              {activeMethod === "voice" && (
                <div className="mb-4 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-sky-200 bg-white/60 px-4 py-5 text-center">
                  <Mic
                    className={cn(
                      "size-6",
                      isListening ? "text-emergency" : "text-sky-600",
                    )}
                    aria-hidden
                  />
                  <p className="text-sm text-ink-700">
                    Voice recognition is a stub. Type your description below.
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
              )}

              {/* Text input + send */}
              <div className="relative flex flex-col">
                <Textarea
                  rows={3}
                  placeholder="Type to describe the incident…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[80px] resize-none rounded-[24px] border-white/70 bg-white/58 px-5 py-4 pr-20 text-base leading-relaxed text-ink-900 shadow-glass-soft placeholder:text-ink-500/80 focus-visible:ring-sky-400/60"
                />
                <div className="pointer-events-none absolute inset-x-4 bottom-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-ink-400">
                    {input.length}/4000
                  </span>
                  <span className="pointer-events-auto">
                    <Button
                      type="button"
                      size="icon"
                      disabled={submitting || !input.trim()}
                      onClick={sendMessage}
                      className="size-11 rounded-full bg-sky-600 shadow-glass-soft hover:bg-sky-700"
                      aria-label="Send message"
                    >
                      {submitting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                    </Button>
                  </span>
                </div>
              </div>
            </div>
          </GlassPanel>

          {/* Scenario chips */}
          <div className="flex flex-col gap-2">
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
                  onClick={() => applyScenario(primaryScenario)}
                  className="inline-flex h-14 shrink-0 items-center gap-3 rounded-[18px] border border-white/75 bg-white/65 px-6 text-sm font-semibold text-ink-800 shadow-glass-soft transition-colors hover:bg-white"
                >
                  <Receipt className="size-4 text-sky-700" aria-hidden />
                  {primaryScenario.label}
                </button>
              ) : null}
              {otherScenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => applyScenario(scenario)}
                  className="inline-flex h-14 shrink-0 items-center gap-3 rounded-[18px] border border-white/75 bg-white/56 px-6 text-sm font-semibold text-ink-800 shadow-glass-soft transition-colors hover:bg-white"
                >
                  <WandSparkles className="size-4 text-sky-700" aria-hidden />
                  {scenario.label}
                </button>
              ))}
            </div>
          </div>

          <PrivacyNotice title="Privacy & redaction">
            Aadhaar, PAN, OTPs, full card numbers, and PINs are replaced
            before persistence. We never read full screenshots — only the
            text you paste.
          </PrivacyNotice>

          {lastError ? (
            <Alert variant="destructive">
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{lastError}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        {/* ======== RIGHT: Sidebar ======== */}
        {hasMessages && (
          <aside className="flex min-w-0 flex-col gap-4">
            {/* Official helplines */}
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
                      className="flex h-full flex-col gap-0.5 rounded-2xl border border-sky-100 bg-white/80 p-2.5 transition-colors hover:border-sky-300 hover:bg-sky-50"
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

            {/* Routing result */}
            {caseSnapshot && (
              <RoutingResultCard
                snapshot={caseSnapshot}
                pipeline={pipeline}
                onConfirm={confirmFacts}
                confirming={confirming}
                canConfirm={canConfirm}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function withCaseId(target: string, caseId: string | null): string {
  if (!caseId) return target;
  const [path, query = ""] = target.split("?");
  const params = new URLSearchParams(query);
  params.set("caseId", caseId);
  return `${path}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// ChatBubble — single message in the chat timeline
// ---------------------------------------------------------------------------

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const isEvidence = msg.message_kind === "evidence";

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 shadow-glass-soft">
          <Shield className="size-3.5" />
        </span>
      )}

      <div
        className={cn(
          "max-w-[82%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed",
          isUser
            ? "rounded-br-md bg-sky-600 text-white shadow-glass-soft"
            : isEvidence
              ? "rounded-bl-md border border-sky-200 bg-sky-50/80 text-ink-800 shadow-glass-soft"
              : "rounded-bl-md bg-white/85 text-ink-900 shadow-glass-soft",
        )}
      >
        {isEvidence && (
          <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-sky-600">
            <MessageSquare className="size-3" />
            Evidence
          </span>
        )}
        <p className="whitespace-pre-wrap">{msg.content_redacted}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompactProgress — Step 1 of 5 stepper
// ---------------------------------------------------------------------------

function CompactProgress({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex w-full max-w-[300px] flex-col gap-3 lg:justify-self-end">
      <div className="inline-flex h-9 w-fit items-center rounded-full border border-sky-200 bg-white/55 px-4 text-sm font-semibold text-sky-700 shadow-glass-soft">
        Step {currentStep} of 5
      </div>
      <div className="flex items-center gap-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "h-2 flex-1 rounded-full transition-colors",
              index + 1 <= currentStep
                ? "bg-sky-600"
                : "bg-sky-200/80",
            )}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RoutingResultCard — right sidebar routing + facts + confirm
// ---------------------------------------------------------------------------

function RoutingResultCard({
  snapshot,
  pipeline,
  onConfirm,
  confirming,
  canConfirm,
}: {
  snapshot: CaseStateSnapshot;
  pipeline: Pipeline;
  onConfirm: () => void;
  confirming: boolean;
  canConfirm: boolean;
}) {
  const tone =
    pipeline === "golden_hour"
      ? "emergency"
      : pipeline === "post_golden_hour"
        ? "primary"
        : "saffron";

  const facts = snapshot.facts || {};
  const factItems = [
    { label: "UPI ID", value: facts.upi_id, mono: true },
    {
      label: "Amount",
      value:
        snapshot.amount != null
          ? `Rs ${snapshot.amount.toLocaleString("en-IN")}`
          : facts.amount != null
            ? `Rs ${facts.amount.toLocaleString("en-IN")}`
            : null,
      highlight: true,
    },
    { label: "UTR", value: facts.utr, mono: true },
    { label: "Bank", value: facts.bank },
    { label: "Payment app", value: facts.payment_app },
    { label: "Phone", value: facts.phone, mono: true },
    { label: "Handle", value: facts.handle, mono: true },
    { label: "URL", value: facts.url, mono: true },
    { label: "District", value: snapshot.location?.district || null },
  ].filter((f) => f.value != null);

  const missingFields = snapshot.missing_required_fields || [];

  return (
    <GlassPanel variant="muted" className="flex flex-col gap-4 p-5">
      {/* Pipeline badges */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={PIPELINE_LABEL[pipeline]} tone={tone} />
        {snapshot.routing?.confidence != null && (
          <StatusBadge
            label={`Confidence ${Math.round(
              (snapshot.routing.confidence || 0) * 100,
            )}%`}
            tone="default"
          />
        )}
        {snapshot.routing?.golden_hour_remaining_seconds != null && (
          <StatusBadge
            label={`~${Math.floor(
              (snapshot.routing.golden_hour_remaining_seconds || 0) / 60,
            )}m ${(snapshot.routing.golden_hour_remaining_seconds || 0) % 60}s left`}
            tone="saffron"
          />
        )}
      </div>

      {PIPELINE_HINT[pipeline] ? (
        <p className="text-sm text-ink-500">{PIPELINE_HINT[pipeline]}</p>
      ) : null}

      <Separator />

      {/* Fraud type detection */}
      {snapshot.fraud_type && snapshot.fraud_type !== "unknown" && (
        <div className="flex items-center gap-2">
          <div className="inline-flex size-6 items-center justify-center rounded-full bg-sky-100 text-sky-700">
            <ShieldCheck className="size-3.5" />
          </div>
          <span className="text-sm font-medium text-ink-900">
            Detected:{" "}
            <span className="capitalize">
              {snapshot.fraud_type.replace(/_/g, " ")}
            </span>
          </span>
        </div>
      )}

      {/* Extracted facts */}
      {factItems.length > 0 ? (
        <CaseSummaryCard
          title="Extracted facts"
          description="Aadhaar, PAN, OTPs are redacted."
          facts={factItems}
          columns={2}
          className="border-0 bg-white/60 shadow-none"
        />
      ) : null}

      {/* Missing fields */}
      {missingFields.length > 0 && (
        <Alert className="border-saffron-200 bg-saffron-50/80">
          <Clock className="size-4" />
          <AlertTitle className="text-xs font-semibold">
            Still needed
          </AlertTitle>
          <AlertDescription className="text-xs">
            {missingFields
              .map((f) =>
                f
                  .replace("fraud_type", "fraud type")
                  .replace("payment_method", "payment method")
                  .replace("incident_at", "incident time")
                  .replace("location.district", "district")
                  .replace("receiver_identifier", "receiver UPI/phone")
                  .replace(/_/g, " "),
              )
              .join(" · ")}
          </AlertDescription>
        </Alert>
      )}

      {/* Safety flags */}
      {snapshot.safety_flags && snapshot.safety_flags.length > 0 && (
        <Alert variant="destructive" className="border-emergency/20 bg-emergency-soft/60">
          <AlertTitle className="text-xs font-semibold">Safety notice</AlertTitle>
          <AlertDescription className="text-xs">
            {snapshot.safety_flags.join(", ")}
          </AlertDescription>
        </Alert>
      )}

      {/* Confirm button */}
      {canConfirm ? (
        <>
          <Separator />
          <Button
            type="button"
            size="lg"
            variant={pipeline === "golden_hour" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={confirming}
            className="w-full rounded-full"
          >
            {confirming ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            {confirming ? "Creating case…" : "Confirm and continue"}
            {!confirming && <ChevronRight className="size-4" />}
          </Button>
        </>
      ) : (
        <p className="text-center text-xs text-ink-400">
          Answer the questions above to continue.
        </p>
      )}
    </GlassPanel>
  );
}
