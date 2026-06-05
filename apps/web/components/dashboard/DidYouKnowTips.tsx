"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Tip data                                                          */
/* ------------------------------------------------------------------ */

interface Tip {
  icon: string;
  headline: string;
  description: string;
  tags: string[];
}

const TIPS: Tip[] = [
  {
    icon: "💡",
    headline: "Banks never ask for OTP over phone",
    description:
      "If someone calls asking for your OTP, hang up immediately. It's always a scam.",
    tags: ["money_movement_fraud", "identity_account_control"],
  },
  {
    icon: "🔐",
    headline: "UPI PIN is only for sending money",
    description:
      "You never need to enter your PIN to receive money. Anyone asking for it is scamming you.",
    tags: ["money_movement_fraud"],
  },
  {
    icon: "💼",
    headline: "Real employers don't ask for money",
    description:
      "If a job asks for a registration fee or training deposit, it's a job scam.",
    tags: ["money_movement_fraud"],
  },
  {
    icon: "📋",
    headline: "Banks don't do KYC over WhatsApp",
    description:
      "No bank will send a link asking you to update KYC. Always visit the official app or branch.",
    tags: ["identity_account_control", "platform_content_suspect"],
  },
  {
    icon: "📸",
    headline: "Screenshots don't confirm payments",
    description:
      "Scammers send fake payment screenshots. Always check your bank balance, not their image.",
    tags: ["money_movement_fraud"],
  },
  {
    icon: "📱",
    headline: "Never install apps a stranger suggests",
    description:
      "Apps like AnyDesk or TeamViewer give scammers full control of your phone. Refuse immediately.",
    tags: ["device_data_compromise", "identity_account_control"],
  },
  {
    icon: "🎁",
    headline: "You can't win a contest you never entered",
    description:
      "Messages saying you've won a lottery or prize are fake. Never pay a fee to claim winnings.",
    tags: ["platform_content_suspect"],
  },
  {
    icon: "📦",
    headline: "Verify delivery links before clicking",
    description:
      "Scammers send fake courier links asking for small re-delivery fees. Track only through official websites.",
    tags: ["platform_content_suspect", "money_movement_fraud"],
  },
  {
    icon: "👮",
    headline: "Police don't call for digital arrests",
    description:
      "No government official will demand money over a video call. This is a growing scam tactic.",
    tags: ["personal_safety_extortion"],
  },
  {
    icon: "🛡️",
    headline: "Strangers online aren't who they seem",
    description:
      "Never share private photos with someone you haven't met in person. If threatened, report — don't pay.",
    tags: ["personal_safety_extortion"],
  },
];

/* ------------------------------------------------------------------ */
/*  Sort tips by relevance to the user's fraud type                    */
/* ------------------------------------------------------------------ */

function sortTipsByRelevance(fraudType: string | null): Tip[] {
  if (!fraudType) return [...TIPS];
  const scored = TIPS.map((t) => ({
    tip: t,
    score: t.tags.includes(fraudType) ? 1 : 0,
  }));
  scored.sort((a, b) => b.score - a.score);
  // Stable sort: matching tips first, rest in original order
  return scored.map((s) => s.tip);
}

/* ------------------------------------------------------------------ */
/*  Did You Know? carousel                                            */
/* ------------------------------------------------------------------ */

export function DidYouKnowTips({ fraudType }: { fraudType?: string | null }) {
  const tips = useMemo(() => sortTipsByRelevance(fraudType ?? null), [fraudType]);

  const [current, setCurrent] = useState(0);
  const [fading, setFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);
  const touchStartX = useRef(0);

  const goTo = useCallback(
    (idx: number) => {
      if (idx === current) return;
      setFading(true);
      setTimeout(() => {
        setCurrent(((idx % tips.length) + tips.length) % tips.length);
        setFading(false);
      }, 150);
    },
    [current, tips.length],
  );

  const next = useCallback(() => goTo(current + 1), [goTo, current]);
  const prev = useCallback(() => goTo(current - 1), [goTo, current]);

  /* Auto-rotate every 8 seconds */
  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (!pausedRef.current) next();
    }, 8000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [next]);

  const pause = () => {
    pausedRef.current = true;
    setTimeout(() => {
      pausedRef.current = false;
    }, 6000);
  };

  const onPrev = () => { pause(); prev(); };
  const onNext = () => { pause(); next(); };

  /* Touch swipe */
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      pause();
      if (dx > 0) prev(); else next();
    }
  };

  const tip = tips[current];

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-50 via-sky-50 to-teal-50/60 p-5 shadow-sm">
      {/* Desktop arrow buttons — visible on hover */}
      <button
        onClick={onPrev}
        aria-label="Previous tip"
        className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/70 p-1 text-slate-400 shadow-sm opacity-0 transition-all hover:bg-white hover:text-slate-600 group-hover:opacity-100 sm:block hidden"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        onClick={onNext}
        aria-label="Next tip"
        className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/70 p-1 text-slate-400 shadow-sm opacity-0 transition-all hover:bg-white hover:text-slate-600 group-hover:opacity-100 sm:block hidden"
      >
        <ChevronRight className="size-4" />
      </button>

      {/* Content */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="mx-0 px-0 text-center sm:mx-8 sm:px-2"
      >
        <span className="mb-2 inline-block text-3xl">{tip.icon}</span>
        <p className="text-[15px] font-bold text-slate-800">{tip.headline}</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-slate-500">
          {tip.description}
        </p>
      </div>

      {/* Dots */}
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {tips.map((_, i) => (
          <button
            key={i}
            onClick={() => { pause(); goTo(i); }}
            aria-label={`Tip ${i + 1}`}
            className={`size-2 rounded-full transition-all ${
              i === current
                ? "bg-teal-500 scale-110"
                : "bg-slate-300 hover:bg-slate-400"
            }`}
          />
        ))}
      </div>

      {/* Fade overlay during transition */}
      {fading && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-white/40" />
      )}
    </div>
  );
}
