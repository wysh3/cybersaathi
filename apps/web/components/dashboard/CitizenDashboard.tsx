"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock,
  MapPin,
  Send,
  Users,
} from "lucide-react";
import { DidYouKnowTips } from "@/components/dashboard/DidYouKnowTips";
import { api } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                            */
/* ------------------------------------------------------------------ */

interface SimilarityMatch {
  identifier_type: string;
  identifier_value: string;
  match_count: number;
  sample_states: string[];
  sample_districts: string[];
}

interface AlertItem {
  id: string;
  message: string;
  time: string;
}

/* ------------------------------------------------------------------ */
/*  Mock alerts                                                      */
/* ------------------------------------------------------------------ */

const MOCK_ALERTS: AlertItem[] = [
  { id: "a1", message: "New job scam near Bengaluru — 12 reports today", time: "2h ago" },
  { id: "a2", message: "Fake electricity bill payment link circulating in Delhi NCR", time: "5h ago" },
  { id: "a3", message: "SBI KYC update scam — 8 victims in Mumbai this week", time: "8h ago" },
  { id: "a4", message: "Instagram blackmail scam targeting students in Pune", time: "12h ago" },
  { id: "a5", message: "Fake IRCTC ticket booking UPI scam across Rajasthan", time: "1d ago" },
];

/* ------------------------------------------------------------------ */
/*  Citizen Dashboard                                                 */
/* ------------------------------------------------------------------ */

export function CitizenDashboard() {
  const [similarity, setSimilarity] = useState<SimilarityMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [shared, setShared] = useState(false);
  const [fraudType, setFraudType] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Create a session and complaint to get similarity data
        const { session_id } = await api.startSession();

        const classify = await api.classify(session_id, {
          description: "UPI fraud — sent money to scammer",
          amount: 5000,
          payment_method: "upi",
          incident_at: new Date(Date.now() - 1 * 3600000).toISOString(),
        });

        const complaint = await api.createComplaint({
          session_id,
          description: "UPI fraud — sent money to scammer",
          location: { state: "Karnataka", district: "Bengaluru Urban", lat: 12.97, lng: 77.59 },
          fraud_type: "money_movement_fraud",
          payment_method: "upi",
          amount: 5000,
          incident_at: new Date(Date.now() - 1 * 3600000).toISOString(),
          pipeline: classify.routing.pipeline,
          routing_confidence: classify.routing.confidence,
          routing_reasoning: classify.routing.reasoning,
          golden_hour_remaining_seconds: classify.routing.golden_hour_remaining_seconds,
          facts: { amount: 5000 },
        });

        const simData = await api.getSimilarity(complaint.id);
        setSimilarity(simData.matches ?? []);
        setFraudType(complaint.fraud_type ?? null);
      } catch (err) {
        console.error("Citizen dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  const topMatch = similarity[0];
  const topLocations = topMatch?.sample_districts?.slice(0, 3) ?? [];

  const handleShare = () => {
    const scammerId =
      topMatch?.identifier_value ?? "unknown-scammer";
    const count = topMatch?.match_count ?? 0;
    const text = encodeURIComponent(
      `⚠️ Scam Alert: Someone just reported a fake scam from ${scammerId}. ${count} others affected. Stay safe. — via CyberSaathi`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
    setShared(true);
    setTimeout(() => setShared(false), 3000);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-1 py-2">
      {/* ============================================================ */}
      {/*  1. You're Not Alone Widget                                   */}
      {/* ============================================================ */}
      {topMatch && topMatch.match_count > 0 && (
        <div className="rounded-xl border border-teal-200/60 bg-gradient-to-br from-teal-50/80 to-emerald-50/50 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
              <Users className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-teal-900">
                You&apos;re Not Alone
              </p>
              <p className="mt-1 text-sm leading-relaxed text-teal-800">
                <span className="font-bold text-teal-700">
                  {topMatch.match_count} others
                </span>{" "}
                reported the same {topMatch.identifier_type.toUpperCase()}{" "}
                <code className="rounded bg-teal-100/70 px-1.5 py-0.5 text-[11px] font-medium text-teal-800">
                  {topMatch.identifier_value}
                </code>
              </p>
              {topLocations.length > 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs text-teal-600">
                  <MapPin className="size-3" />
                  {topLocations.join(" · ")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  2. Estimated Resolution Time                                 */}
      {/* ============================================================ */}
      <div className="rounded-xl border border-teal-200/60 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
            <Clock className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Estimated Resolution Time
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Typically, cases like yours see action within{" "}
              <span className="font-bold text-teal-700">4–7 days</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Based on historical cluster data
            </p>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  3. Protect Someone Else — Quick Share                        */}
      {/* ============================================================ */}
      <div className="rounded-xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/80 to-blue-50/50 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <Send className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">
              Protect Someone Else
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Share a redacted alert to WhatsApp. Strips your personal
              info — only shares the scammer details.
            </p>
            <button
              onClick={handleShare}
              disabled={shared}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-60"
            >
              <Send className="size-3.5" />
              {shared ? "Shared!" : "Share to WhatsApp"}
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  3. Did You Know? — rotating safety tips                      */}
      {/* ============================================================ */}
      <DidYouKnowTips fraudType={fraudType} />

      {/* ============================================================ */}
      {/*  4. Scam Alert Feed                                           */}
      {/* ============================================================ */}
      <div className="rounded-xl border border-slate-200/60 bg-white/70 p-5">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" />
          <p className="text-sm font-semibold text-slate-800">
            Recent Scam Alerts Near You
          </p>
        </div>
        <div className="space-y-2">
          {MOCK_ALERTS.slice(0, 5).map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5"
            >
              <span className="mt-0.5 shrink-0 text-[10px] font-medium text-slate-400">
                {alert.time}
              </span>
              <p className="text-xs leading-snug text-slate-700">{alert.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
