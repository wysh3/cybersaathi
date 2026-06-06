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
  Plus,
  Receipt,
  Search,
  Send,
  Shield,
  ShieldCheck,
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdCounter = useRef(0);
  const prevMsgCount = useRef(0);

  // Derived state
  const hasMessages = chatMessages.length > 1;
  const routing = caseSnapshot?.routing;
  const pipeline = (routing?.pipeline || "fall_back") as Pipeline;
  const canConfirm =
    caseSnapshot?.next_action === "confirm_facts";
  const currentStep = canConfirm ? 4 : hasMessages ? 2 : 1;
  // Chat started — pill has been expanded
  const chatStarted = hasMessages;

  // Auto-scroll only when a new message arrives (not on every re-render).
  // Use instant scroll to prevent the chat from visually "jumping up."
  useEffect(() => {
    const count = chatMessages.length;
    if (count > prevMsgCount.current) {
      prevMsgCount.current = count;
      // Small delay so the DOM has painted the new message
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      });
    }
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

  async function sendMessage(customText?: string, customEvidence?: string) {
    const text = (customText !== undefined ? customText : input).trim();
    if (!text && !imageFile) return;
    if (!conversationId) return;
    setSubmitting(true);
    setError(null);

    // Convert image to base64 for sending
    let imageBase64: string | null = null;
    if (imageFile) {
      imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip the data:image/...;base64, prefix
          const base64 = result.split(",")[1] || result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });
    }

    const msgId = `local-${++messageIdCounter.current}`;
    const displayText = text || (imageFile ? "Image attached" : "");
    const userMsg: ChatMessage = {
      id: msgId,
      conversation_id: conversationId,
      role: "user",
      content_redacted: displayText,
      message_kind: "chat",
      metadata: imageFile ? { has_image: true, image_preview: imagePreview } : {},
      created_at: new Date().toISOString(),
    };
    appendChatMessages([userMsg]);

    const sentInput = text;
    const sentEvidence = customEvidence !== undefined ? customEvidence : (showEvidencePanel ? evidenceText : null);
    setInput("");
    clearImage();
    if (showEvidencePanel || customEvidence) {
      setEvidenceText("");
      setShowEvidencePanel(false);
      setActiveMethod("write");
    }

    try {
      const response = await api.sendIntakeChatTurn(conversationId, {
        message: sentInput || "Image attached — extract text.",
        evidence_text: sentEvidence,
        image_base64: imageBase64 || undefined,
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
    if (scenario.evidence) {
      setEvidenceText(scenario.evidence);
      setActiveMethod("sms");
      setShowEvidencePanel(true);
    }
    sendMessage(scenario.description, scenario.evidence);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    // Don't revoke — the URL may still be referenced by a chat bubble
    setImageFile(null);
    setImagePreview(null);
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

  // Typing animation state
  const FULL_TITLE = "One Portal. Every Cyber Emergency.";
  const [typedChars, setTypedChars] = useState(0);
  const [typingDone, setTypingDone] = useState(false);

  useEffect(() => {
    if (chatStarted) return;
    if (typedChars < FULL_TITLE.length) {
      const ch = FULL_TITLE[typedChars] || "";
      // Fast initial burst then slow down
      const delay = typedChars < 12 ? 18 : ch === "." || ch === " " ? 110 : 32;
      const t = setTimeout(() => setTypedChars((c) => c + 1), delay);
      return () => clearTimeout(t);
    }
    const doneTimer = setTimeout(() => setTypingDone(true), 300);
    return () => clearTimeout(doneTimer);
  }, [typedChars, chatStarted, FULL_TITLE]);

  const primaryScenario = SAMPLE_SCENARIOS.find((s) => s.isPrimary);
  const otherScenarios = SAMPLE_SCENARIOS.filter((s) => !s.isPrimary);

  return (
    <div className="mx-auto flex w-full flex-col items-center">
      {/* ============================================================ */}
      {/* HERO MODE — typing animation + pill input                    */}
      {/* ============================================================ */}
      {!chatStarted ? (
        <div className="flex w-full max-w-4xl flex-col items-start px-4 pb-16 pt-10 md:px-8 md:pt-16">
          <h1 className="mb-6 text-left font-serif text-5xl font-normal leading-[1.05] tracking-tight text-ink-900 sm:text-6xl md:text-7xl">
            {FULL_TITLE.split("").map((ch, i) => (
              <span
                key={i}
                className={cn(
                  "transition-all duration-[50ms] ease-out",
                  i < typedChars
                    ? "translate-y-0 opacity-100 blur-none"
                    : "translate-y-[2px] opacity-0 blur-[3px]",
                )}
              >
                {ch}
              </span>
            ))}
          </h1>
          <p className={cn(
            "mb-10 max-w-md text-left text-base font-normal leading-relaxed text-ink-500 transition-all duration-700 ease-out sm:text-lg",
            typingDone ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
          )}>
            Simple. Secure. Supportive.<br className="hidden sm:inline" />
            Cybercrime emergency guidance, designed around you.
          </p>
          <div className={cn(
            "group relative mb-10 w-full max-w-2xl transition-all duration-700 delay-100 ease-out",
            typingDone ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
          )}>
            <div className="flex w-full items-center rounded-full border border-white/80 bg-white/95 py-2 pl-3 pr-2 shadow-glass backdrop-blur-xl transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-200/50">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/80 text-ink-400 transition-colors hover:bg-sky-50 hover:text-sky-500"
                aria-label="Add image"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="size-5 rounded-full object-cover" />
                ) : (
                  <Plus className="size-5" />
                )}
              </button>
              <input
                type="text"
                placeholder="Describe what happened (e.g., UPI fraud 15 minutes ago)…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 border-0 bg-transparent px-3 py-3 text-base text-ink-900 outline-none placeholder:text-ink-500/50 focus:outline-none focus:ring-0"
              />
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={submitting || !input.trim()}
                className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-sky-500 shadow-glass-soft transition-all duration-200 hover:bg-sky-600 disabled:opacity-40"
                aria-label="Submit intake description"
              >
                {submitting ? (
                  <Loader2 className="size-5 animate-spin text-white" />
                ) : (
                  <Search className="size-5 text-white" />
                )}
              </button>
            </div>
          </div>

          {/* Common scenario suggestions */}
          <div className={cn(
            "flex w-full max-w-2xl flex-col gap-3 text-left transition-all duration-700 delay-200 ease-out",
            typingDone ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
          )}>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              Or select a demo scenario
            </p>
            <div className="flex flex-wrap gap-2.5">
              {SAMPLE_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => applyScenario(scenario)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/80 bg-white/60 px-4 py-2.5 text-xs font-semibold text-ink-800 shadow-glass-soft transition-all hover:border-sky-200 hover:bg-white"
                >
                  {scenario.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* CHAT MODE — minimal, serene, clean                           */
        /* ============================================================ */
        <div className="relative flex min-h-dvh w-full max-w-5xl flex-col animate-fade-in">
          {/* Messages area — scrollable, grows from bottom */}
          <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-28 pt-6 md:px-8">
            {/* Spacer pushes messages to bottom when there's room */}
            <div className="flex-1" />
            {chatMessages.map((msg, i) => (
              <ChatBubble key={msg.id || i} msg={msg} />
            ))}
            {submitting && (
              <div className="flex items-start gap-3 pt-4">
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-400 shadow-glass-soft">
                  <Shield className="size-3.5" />
                </span>
                <div className="rounded-xl rounded-bl-md bg-white/85 px-5 py-4 shadow-glass-soft">
                  <p className="text-sm text-ink-500">Thinking…</p>
                </div>
              </div>
            )}
            {canConfirm && !submitting && (
              <div className="flex justify-start gap-3 mt-1">
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-400 shadow-glass-soft">
                  <Shield className="size-3.5" />
                </span>
                <button
                  type="button"
                  onClick={confirmFacts}
                  disabled={confirming}
                  className="rounded-xl rounded-bl-md bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-glass-soft transition-all duration-200 hover:bg-sky-600 disabled:opacity-50"
                >
                  {confirming ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-3.5 animate-spin" />
                      Creating case…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="size-4" />
                      Confirm — this looks right
                    </span>
                  )}
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Floating pill input at bottom */}
          <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#fafbfc] via-[#fafbfc]/85 to-transparent pb-5 pt-8 md:pb-6">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 md:px-6">
              <div className="flex w-full items-center rounded-full border border-white/80 bg-white/95 py-1.5 pl-3 pr-1.5 shadow-glass backdrop-blur-xl transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-200/50">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/80 text-ink-400 transition-colors hover:bg-sky-50 hover:text-sky-500"
                  aria-label="Add image"
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="size-5 rounded-full object-cover" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                </button>
                <input
                  type="text"
                  placeholder="Type your response…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 border-0 bg-transparent px-2 py-3 text-base text-ink-900 outline-none placeholder:text-ink-500/50 focus:outline-none focus:ring-0"
                />
                <button
                  type="button"
                  onClick={() => sendMessage()}
                  disabled={submitting || !input.trim()}
                  className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-sky-500 shadow-glass-soft transition-all duration-200 hover:bg-sky-600 disabled:opacity-40"
                  aria-label="Send message"
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin text-white" />
                  ) : (
                    <Send className="size-4 text-white" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
        aria-label="Upload image"
      />
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
  const imagePreview = msg.metadata?.image_preview as string | undefined;
  const hasContent = msg.content_redacted && msg.content_redacted !== "Image attached";

  return (
    <div
      className={cn(
        "flex gap-3 mb-3",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-400 shadow-glass-soft">
          <Shield className="size-3.5" />
        </span>
      )}

      <div
        className={cn(
          "max-w-[82%] rounded-xl px-5 py-3.5 text-sm leading-relaxed",
          isUser
            ? "rounded-br-md bg-sky-300 text-sky-950 shadow-glass-soft"
            : isEvidence
              ? "rounded-bl-md border border-sky-100 bg-blue-50/60 text-ink-800 shadow-glass-soft"
              : "rounded-bl-md bg-white/85 text-ink-900 shadow-glass-soft",
        )}
      >
        {isEvidence && (
          <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-sky-400">
            <MessageSquare className="size-3" />
            Evidence
          </span>
        )}
        {imagePreview && (
          <img
            src={imagePreview}
            alt="Uploaded"
            className="mb-2 w-full max-w-[240px] rounded-lg object-cover shadow-sm"
          />
        )}
        {hasContent && (
          <p className="whitespace-pre-wrap">{msg.content_redacted}</p>
        )}
        {!hasContent && !imagePreview && (
          <p className="whitespace-pre-wrap">{msg.content_redacted}</p>
        )}
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
      <div className="inline-flex h-9 w-fit items-center rounded-full border border-sky-100 bg-white/55 px-4 text-sm font-semibold text-sky-400 shadow-glass-soft">
        Step {currentStep} of 5
      </div>
      <div className="flex items-center gap-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "h-2 flex-1 rounded-full transition-colors",
              index + 1 <= currentStep
                ? "bg-sky-300"
                : "bg-sky-100/80",
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
          <div className="inline-flex size-6 items-center justify-center rounded-full bg-sky-50 text-sky-400">
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
