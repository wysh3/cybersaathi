---
name: cybersaathi-product-engineering
description: "Use when implementing CyberSaathi product behavior: emergency intake, urgency routing, Golden Hour flow, complaint drafting, seed data, scam similarity, fraud heatmaps, accountability triggers, dashboards, and victim-safe copy."
---

# CyberSaathi Product Engineering

Use this skill for domain implementation. `AGENTS.md` remains the full product
spec; this skill is the quick execution checklist.

## Build the product, not a landing page

- First screen asks "What happened?"
- No registration before emergency intake.
- Do not ask users to pick a fraud category first.
- Route from user description, pasted SMS, uploaded evidence, or voice stub.
- Always show the next official action.

## Required deterministic routes

- Financial fraud under 60 minutes: Golden Hour Engine.
- Financial fraud at or after 60 minutes: Post-Golden-Hour Pipeline.
- Non-financial cybercrime: Post-Golden-Hour or Fall-Back Agent.
- Low-confidence, multi-type, or distressed cases: constrained Fall-Back Agent.

## Golden Hour behavior

- Red emergency UI only in this flow.
- One dominant CTA: "Call 1930 Now".
- Countdown visible.
- Show exact call script and extracted facts: amount, UTR, UPI ID, timestamp,
  bank/app, scammer identifier.
- Capture helpline reference number manually.
- After reference capture, continue to complaint package generation.
- Never promise recovery.

## Complaint package behavior

Generate editable:

- NCRP complaint draft.
- Bank dispute email.
- Evidence timeline.
- Recovery workflow checklist.

Use redacted evidence text and never store Aadhaar, PAN, OTPs, bank passwords,
PINs, or full card numbers.

## Intelligence behavior

- Similarity counts come from seed data.
- Heatmaps use anonymized seeded reports.
- Accountability trigger requires 50+ unresolved matching reports within a
  30-day window and no mock FIR/resolution.
- Generated alert, digest, RTI, and infographic copy must use cluster data, not
  invented statistics.

## Demo scenarios

Always preserve these:

- Priya: Rs 2,500 UPI fraud 15 minutes ago, route to Golden Hour.
- Sextortion plus UPI demand.
- Job scam with multiple payments over several days.
- Account hack with uncertain financial loss.

## Copy rules

- Calm, direct, non-blaming, multilingual-ready.
- Distinguish generated drafts from official submission.
- Do not impersonate law enforcement.
- Do not advise paying scammers.
