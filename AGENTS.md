# AGENTS.md - CyberSaathi Build Specification

<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in
`node_modules/next/dist/docs/`. Training data can be outdated; the installed
Next.js documentation is the source of truth for App Router APIs, file
conventions, routing, caching, forms, metadata, and runtime behavior.

If `node_modules/next/dist/docs/` does not exist because the project is on
Next.js 16.1 or earlier, run `npx @next/codemod@latest agents-md` after the
Next.js project is initialized, then read the generated `.next-docs/` docs
before editing Next.js code.

<!-- END:nextjs-agent-rules -->

This file is the single source of truth for AI agents building CyberSaathi.
Follow it over any older pitch notes, partial implementation plans, or demo
scripts. The product is a cybercrime-first AI Emergency Government Navigator
for Hack4SOC 3.0, Governance PS1.

## Current Alpha App State

CyberSaathi is now beyond a static MVP spec. The current repository contains
an alpha demo app with:

- Next.js 16 App Router frontend.
- Tailwind CSS v4.
- shadcn/ui `radix-nova` components with `components.json`.
- lucide-react as the active icon family.
- FastAPI backend with deterministic mock ML/integration adapters.
- Real India SVG heatmap from vendored local map data.
- Mobile PWA-style bottom navigation and desktop app sidebar.
- PostgreSQL persistence foundation with Alembic and SQLAlchemy. Normal local
  and deployed runtime is Postgres-first; `DATABASE_ENABLED=false` is only an
  explicit in-memory fallback for isolated tests or emergency demos.
- Passing backend, frontend, browser-smoke, and E2E checks must be verified
  after each merge; do not rely on old baseline claims.

Agents must keep this current implementation truth above older language in
this document that describes the original MVP plan.

Every agent must read `team/STATUS.md` before coding. If a feature has a
`Blocked By` line, do not claim it until that blocker is satisfied.
Vishruth should use `team/MERGE-PLAN.md` for branch sequencing and merge decisions.

`details.md` is retained as historical/source material. This file and
`team/STATUS.md` win when there is a conflict.

## Current Product Direction

CyberSaathi is now being built as a serious competition-grade web app, not a
thin demo. The next design milestone is a full product-shell redesign inspired
by `cybersaathi_final_design_agent_pack/`:

- soft off-white app canvas
- premium but restrained public-service visual language
- deep green/navy primary actions
- large calm search/intake surface
- polished desktop app shell
- true mobile app feel with bottom navigation
- fewer dense panels per viewport
- richer spacing, shadows, icons, status chips, and document surfaces

Use the reference for composition, spacing, polish, mobile shell, and calm
government-service tone. Do not copy its fake text, generic service categories,
or marketing-first premise. CyberSaathi remains emergency-intake-first.

Known design gaps after F005 review:

- Mobile bottom nav overlap must be fixed before final UI work is trusted.
- Intake should hide early amount/minutes/payment details behind a disclosure.
- Active Golden Hour and Documents routes need dedicated design-pack passes.
- Screenshot folders must be consolidated.
- Next 16 `jsx` config and local `next dev` behavior need review.

## 0. Project Skills For Coding Agents

Use these local skills when their descriptions match the task:

- `.agents/skills/nextjs/SKILL.md` for Vercel-maintained Next.js App Router
  guidance, Server Components, caching, route handlers, metadata, file
  conventions, and deployment-sensitive framework patterns.
- `.agents/skills/nextjs-ai-agent-coding/SKILL.md` for CyberSaathi-specific
  Next.js rules: read version-matched installed Next docs, keep the first
  screen as emergency intake, and avoid real official integrations.
- `.agents/skills/fastapi/SKILL.md` for official FastAPI best practices,
  Pydantic conventions, dependencies, response models, and FastAPI CLI usage.
- `.agents/skills/cybersaathi-product-engineering/SKILL.md` for building
  CyberSaathi product flows, seeded demos, emergency routing, documents,
  similarity, dashboards, and accountability behavior.
- `.agents/skills/fastapi-mock-adapters/SKILL.md` for FastAPI backend work,
  Pydantic models, mock official integrations, deterministic ML adapters, and
  seed-data APIs.
- `.agents/skills/playwright-cli/SKILL.md` for browser automation, visual QA,
  flow testing, screenshots, traces, and interaction checks.
- `.agents/skills/accessibility/SKILL.md` for WCAG 2.2 accessibility,
  keyboard navigation, screen-reader support, focus states, contrast, and
  public-service usability.
- `.agents/skills/verification-and-qa/SKILL.md` for linting, typechecking,
  Playwright checks, accessibility review, privacy redaction checks, and final
  acceptance verification.
- `.agents/skills/design-taste-frontend/SKILL.md` for trust-first public-sector
  UI taste and anti-generic frontend guardrails.
- `.agents/skills/image-to-code-skill/SKILL.md` when turning the attached
  generated design reference into implemented UI. Use it with CyberSaathi
  constraints; do not create a marketing landing page.
- `.agents/skills/imagegen-frontend-web/SKILL.md` and
  `.agents/skills/imagegen-frontend-mobile/SKILL.md` when generating or
  analyzing additional section-level visual references for the redesign.
- `.agents/skills/shadcn/SKILL.md` for shadcn/ui initialization, component
  discovery, component docs, theming, composition rules, `components.json`,
  semantic tokens, and app-quality UI primitives. Use it before any frontend
  redesign work that mentions shadcn/ui.
- `.agents/skills/postgres-persistence/SKILL.md` for PostgreSQL, SQLAlchemy,
  Alembic, seed loading, DB health, and Postgres-first verification.
- `.agents/skills/cybersaathi-team-workflow/SKILL.md` for team coordination,
  feature claiming, branch naming, status updates, PR readiness, and conflict
  avoidance. Use it whenever a builder says they are Akshay, Nandan, or
  Vishruth; asks what to work on; claims a feature; starts a branch; updates
  status; prepares a commit/PR/merge; or resolves workflow conflicts.
- `.agents/skills/full-output-enforcement/SKILL.md` for complete code output
  and avoiding placeholder implementations.

## 0.1 Team Workflow Rules

- Before coding on team work, read `team/STATUS.md`.
- Claim exactly one feature before editing product code.
- Work on feature branches, never directly on `main`.
- Keep `main` demo-stable.
- Update `team/STATUS.md` before and after meaningful work.
- Respect file ownership listed in `team/STATUS.md`.
- If you need another builder's owned files, add a note under the feature
  before editing.
- Use `.agents/skills/cybersaathi-team-workflow/references/git-commands.md` for
  exact git commands.

## 1. Product Definition

CyberSaathi is a **victim-state engine on a crisis timeline** for cybercrime
emergencies. It is not a generic chatbot, not a helpline directory, and not a
marketing landing page. The product detects where a victim is in the
emergency timeline and gives the next correct government-service action with
minimum friction.

The crisis timeline has these stages: **intake → urgency → route → evidence →
draft → track → cluster → accountability**. Every feature in this spec must
move the victim forward by at least one stage. If a feature does not, it
does not belong in V1.

### Core thesis

Victims lose money and time because they do not know what to do, what to say,
what evidence matters, or how to move through government systems under stress.
CyberSaathi converts panic into a guided protocol:

1. Detect urgency.
2. Route to the right emergency flow.
3. Extract evidence.
4. Draft official complaint material.
5. Track next actions.
6. Cluster unresolved complaints.
7. Create public accountability pressure from ignored patterns.

This is a single product surface, not seven features stitched together. The
same green/navy design language, the same accessibility rules, the same
non-blaming copy, and the same "honest, never guarantees recovery" tone
apply to every stage.

### V1 scope

Build V1 as a cybercrime-first emergency navigator:

- UPI, banking, wallet, and online-payment fraud.
- Post-golden-hour complaint support for cybercrime cases.
- Scam similarity detection from seeded complaint data.
- Fraud heatmap and cluster dashboard using anonymized demo data.
- Accountability trigger that creates public alert, journalist digest,
  shareable infographic content, and RTI draft.

Other emergency types such as domestic violence, medical emergencies, missing
documents, or disaster response are future expansion. They may appear as
disabled or "coming next" routes only if needed for context, but V1 must not
pretend to fully support them.

### Non-goals

- Do not file FIRs on behalf of users.
- Do not call real government, police, bank, WhatsApp, or RTI services.
- Do not guarantee recovery of stolen funds.
- Do not act as antivirus, scam detector before payment, or criminal
  investigation software.
- Do not store Aadhaar, PAN, bank passwords, card PINs, OTPs, or financial
  credentials.

### Team and context

- Project: CyberSaathi.
- Team: Team AETOS.
- Members: Akshay Kumar, Nandan Kumar C, Vishruth M R.
- Event: Hack4SOC 3.0, Governance PS1: AI Emergency Government Navigator.

Statistics from earlier documents may be used as pitch context, but they must
be labelled "verify before public release" unless a fresh source is checked:

- 28.15 lakh cybercrime complaints in India in 2025.
- Rs 22,495 crore financial losses.
- 55,484 FIRs registered, roughly 2 percent conversion.
- Golden-hour reporting can substantially improve fund blocking.

## 2. Build Target

Optimize the first implementation for a polished hackathon MVP with
production-shaped architecture and simulated integrations.

The MVP must feel real in the browser. It should have an end-to-end working
experience, seeded data, deterministic logic, and convincing generated
documents. It should not depend on unavailable official APIs.

### Required first-screen behavior

The first screen is the product, not a landing page. It asks:

> What happened?

Input modes:

- Text description.
- Voice entry UI stub.
- Screenshot or SMS upload/paste area.
- WhatsApp-style forwarded-message entry simulation.

The first screen must immediately route into the active emergency workflow.
Avoid hero copy, feature-card marketing, and generic "AI assistant" framing.

## 3. Technical Stack

### Frontend

- Framework: Next.js 16 with TypeScript.
- App model: PWA-ready App Router structure.
- Styling: Tailwind CSS v4.
- UI: shadcn/ui `radix-nova` with app-specific components in
  `apps/web/components/app/`.
- Icons: lucide-react is the active icon family. Do not mix icon families.
- State: local React state for isolated flows; Zustand or React context only
  if shared workflow state becomes awkward.
- Rendering: keep server components for static layout and use client
  components only for forms, timers, upload mocks, dashboards, and interactive
  flows.

### Backend

- API: FastAPI.
- Database: PostgreSQL with PostGIS for location-aware complaint and heatmap
  queries.
- Cache/session: Redis for demo session state, rate limiting, and cluster
  count cache.
- Seed data: load deterministic demo complaints from versioned seed fixtures.
- Documents: generate editable plain text and browser-rendered PDF/export
  views for complaint drafts and evidence timelines.

### ML and intelligence layer

For MVP, prefer deterministic logic with clean replacement interfaces.

- Urgency classifier: deterministic rules first.
- OCR extractor: mock adapter that extracts UTR, UPI ID, amount, timestamp,
  phone, and bank from known sample receipts/SMS text.
- NER: mock adapter with regex-backed extraction for Indian cybercrime fields.
- Recovery model: deterministic probability band function based on fraud type,
  time since incident, amount tier, and payment method.
- Similarity engine: exact and fuzzy matching over seeded identifiers and scam
  scripts.
- Clustering: deterministic seeded HDBSCAN-style output for demo, with an
  interface that can later be replaced by real embeddings plus HDBSCAN.
- Fall-back agent: scripted conversational handler for 3 edge cases, not an
  unrestricted LLM.

### Simulated integrations

All official integrations in V1 are mock adapters. Each adapter must have a
clear interface, status response, and mock event log.

- 1930 helpline adapter: simulates call preparation and reference capture.
- NCRP adapter: creates complaint draft and mock submission checklist.
- Bank dispute adapter: creates email draft to bank nodal officer.
- RTI adapter: creates pre-filled RTI draft for the relevant authority.
- WhatsApp adapter: simulates message intake, drop-off, and resume.
- Journalist digest adapter: simulates dashboard alert and email digest.

Never perform real calls to government, police, bank, WhatsApp, or RTI systems
unless a later instruction explicitly replaces this MVP constraint.

## 4. Product Architecture

Use this subsystem split. Names can change in code, but these boundaries must
remain clear.

### Emergency intake and routing

Responsibilities:

- Capture text, voice stub, screenshot/SMS evidence, and location.
- Extract incident time, fraud type, amount, payment method, severity, and
  language.
- Compute urgency.
- Route to Golden Hour, Post-Golden-Hour, or Fall-Back flow.

Routing rules:

- Financial fraud plus time since incident under 60 minutes routes to Golden
  Hour.
- Financial fraud at or after 60 minutes routes to Post-Golden-Hour.
- Non-financial cybercrime routes to Post-Golden-Hour with category-specific
  guidance where available.
- Low confidence, multi-type, high-distress, or unusual cases route to
  Fall-Back Agent.

### Golden Hour Engine

Purpose: help the victim act correctly while fund-blocking probability is
highest.

Required UI:

- Emergency mode with red used only here.
- Countdown showing remaining golden-hour time.
- One dominant action: "Call 1930 Now".
- Prepared case brief with amount, UTR, UPI ID, timestamp, bank/payment app,
  and scammer identifier if available.
- Exact call script in plain language.
- Checklist for during-call details.
- Manual reference-number capture after the call.
- Immediate transition to Post-Golden-Hour follow-up after reference capture.

Required copy tone:

- Direct, calm, and procedural.
- Never say "your money will be recovered".
- Say "reporting quickly may improve fund-blocking chances".

### Post-Golden-Hour Pipeline

Purpose: build a complete complaint package and action plan.

Required steps:

1. Evidence intake from screenshots, pasted SMS, and written description.
2. Mock OCR/NER extraction of UTR, UPI ID, amount, date, bank, phone, handle,
   and payment app.
3. Victim confirmation/editing of extracted facts.
4. Recovery probability band with explanation.
5. Editable NCRP complaint draft.
6. Editable bank dispute email.
7. Evidence timeline view with downloadable/exportable representation.
8. Recovery workflow checklist.
9. Scam similarity result from seeded data.
10. Education or prevention note after the core workflow, not before it.

### Fall-Back AI Agent

Purpose: handle cases that do not fit the deterministic routes.

MVP behavior:

- It is a constrained guided flow, not a free-form chatbot.
- It can ask clarifying questions.
- It can request evidence upload.
- It can route back to Golden Hour if it discovers a fresh financial fraud.
- It can generate complaint material using the same document generator.
- It logs a "training candidate" event for later pipeline improvement.

Required demo edge cases:

- Sextortion plus UPI payment demand.
- Job scam with multiple payments over several days.
- Account hack where the victim is unsure whether money was taken.

### Scam Education Layer

Purpose: teach users how scams are evolving, what to do, and what not to
do — passively integrated into the platform, only after the core action
package is complete.

Required content types:

- How current scams work (refreshed as the Scam Similarity Engine detects
  new patterns, not only static articles).
- What to do immediately if targeted.
- What NOT to do (common mistakes that reduce recovery odds).
- How to alert family members (one-tap pre-written message via WhatsApp
  deep link).

Required delivery:

- Shown after the main action package is complete on the Documents page
  as an `EducationNote` card; never before the user has generated their
  drafts.
- A `ShareWithFamilySheet` (shadcn Sheet from the bottom on mobile) that
  exposes a pre-written Hindi + English warning text and a single "Send
  via WhatsApp" deep link to `https://wa.me/?text=...`. The link opens
  WhatsApp with the text already filled; the user picks the contact.
- Regional language copy structure (Hindi + English first) ready for
  F011's multilingual copy system to extend.

Tone: supportive, never shaming. For sextortion and harassment content
use non-judgmental language that prioritizes safety.

### Investigation Flow

Purpose: step-by-step redirection that tells the victim exactly where to
go next, in what order, and why.

Required behavior:

- Adapts based on:
  - Whether 1930 was called (helpline reference captured).
  - Whether bank was notified (NCRP and bank dispute drafts exported).
  - Whether NCRP complaint was filed (acknowledgement captured).
  - Time elapsed since incident.
  - Type of fraud (financial vs non-financial).
- Output: a numbered checklist that **evolves** as the victim completes
  steps. Completed steps are checked off. The next step is always
  highlighted. The "Do not share" card remains visible until the helpline
  reference is captured.

Required steps (default Indian escalation path):

1. Call 1930 helpline and save the reference number.
2. Place a hold with the receiving bank / payment app.
3. File the NCRP complaint at cybercrime.gov.in.
4. Email the bank nodal officer with the disputed transaction.
5. Follow up with the bank in writing within 3 days.
6. Visit the cyber crime police station if no response within 7 days.
7. If still unresolved, escalate to the state consumer forum.

The component is an interactive `InvestigationChecklist` that reads
workflow state from the Zustand store and visually marks which steps are
done. Its persistence contract is owned by F008 (Documents and Evidence
Polish); F005 ships the component shell and the visual contract.

### Scam Similarity Engine

Purpose: show that one complaint may be part of a larger pattern.

MVP matching keys:

- UPI ID.
- Phone number.
- Bank account number.
- Social media handle.
- Reused scam message or script.
- District/state and fraud type.

Victim-facing output examples:

- "32 other reports in the demo data mention this UPI ID."
- "This phone number appears in 14 seeded reports from Delhi."

Counts must come from seed data. Do not hardcode random numbers in the UI.

### Fraud Heatmap

Purpose: visualize anonymized complaint patterns.

Required filters:

- State.
- District.
- PIN code.
- Fraud type.
- Time range.
- Amount range.

Views:

- Public: aggregate anonymized counts only.
- Police demo: jurisdiction-filtered cluster list with cluster drilldown
  (Map of geographic spread + Timeline of first report to latest report).
- Journalist demo: anonymized trends and export preview.
- Every complaint must capture location at submission time (district
  minimum, PIN code preferred). Location is not linked to victim identity
  in public view. Heatmap updates in near real-time as complaints come in.

### Accountability Engine

Purpose: turn ignored repeated complaints into a public pressure event.

MVP trigger:

- 50 or more matching seeded reports.
- Same pattern or shared identifier.
- 30-day unresolved window.
- No mock FIR or resolution status.

Cluster detection uses HDBSCAN continuously on the complaints database;
triggering is deterministic, not a random LLM judgement.

On trigger, generate:

- Public dashboard flag: "Accountability Alert" — must be visible on the
  Public dashboard top surface, not hidden in a sub-page.
- Journalist digest with cluster stats and a "story lead" headline.
- Shareable infographic content (PNG-ready; exportable to journalists).
- One-click RTI draft addressed to the relevant authority (state cyber
  cell / NCRP / MHA), with the correct authority auto-identified by the
  cluster's geographic spread.
- Victim notification text saying their complaint is part of an escalated
  pattern.

All outputs must be generated from actual seeded complaint fields. No invented
statistics. Journalist digests must be accurate — no hallucinated statistics.
Only aggregated data from actual reports.

### Crime Dashboards

Purpose: data access layer for police, journalists, researchers, and the
public. Different audience, same underlying seed data, different filters
and redaction rules.

Police dashboard:

- Jurisdiction-filtered cluster list.
- Pre-structured complaint data ready for investigation.
- Emerging pattern alerts.
- Case prioritization by severity and amount.
- Scammer identifier lookup.
- Accountability alerts: clusters with no FIR in 30 days.

Journalist / researcher dashboard:

- Anonymized trend data by state / fraud type / time.
- Accountability alerts: triggered clusters with digest.
- Regional fraud cluster breakdowns.
- Emerging scam category tracking.
- Story lead generator from pattern data — surfaced as a top panel.
- Export data as CSV / JSON (anonymized; never victim-identifiable).

Public dashboard:

- Active accountability alerts (top surface, anonymized).
- National and state-level fraud statistics.
- Scam education feed.

Access rules: journalists and researchers get access after verification
(not open registration). Police get access through a separate onboarding
process. Exports from any dashboard are anonymized — no
victim-identifiable information ever exported.

## 5. Data Model

The implementation can use TypeScript types, Python Pydantic models, database
tables, or all three. Preserve these conceptual records.

### Complaint

Fields:

- `id`
- `createdAt`
- `incidentAt`
- `fraudType`
- `paymentMethod`
- `amount`
- `amountCurrency`
- `severity`
- `urgencyScore`
- `pipeline`
- `status`
- `location`
- `victimSessionId`
- `evidenceItemIds`
- `scamIdentifierIds`
- `clusterId`
- `helplineReferenceNumber`
- `generatedDocumentIds`

Do not store street address in public or demo dashboards. District and PIN code
are enough for MVP.

### VictimSession

Fields:

- `id`
- `createdAt`
- `preferredLanguage`
- `contactChannel`
- `optionalContact`
- `currentStep`
- `complaintIds`
- `consentFlags`

Do not require registration to start. Phone or WhatsApp contact is optional
until follow-up reminders are needed.

### EvidenceItem

Fields:

- `id`
- `complaintId`
- `kind`
- `source`
- `originalFilename`
- `extractedText`
- `redactedText`
- `extractedFields`
- `createdAt`

If Aadhaar, PAN, OTP, passwords, card numbers, or bank credentials appear, they
must be redacted before persistence or display.

### ScamIdentifier

Fields:

- `id`
- `type`
- `value`
- `normalizedValue`
- `confidence`
- `sourceEvidenceId`

Identifier types include UPI ID, phone, bank account, social handle, URL, email,
and message-template hash.

### Cluster

Fields:

- `id`
- `status`
- `fraudType`
- `memberComplaintIds`
- `commonIdentifierIds`
- `districts`
- `states`
- `firstReportAt`
- `latestReportAt`
- `totalAmount`
- `reportCount`
- `triggerReason`

### GeneratedDocument

Fields:

- `id`
- `complaintId`
- `kind`
- `title`
- `editableBody`
- `createdAt`
- `exportStatus`

Document kinds:

- `ncrp_complaint_draft`
- `bank_dispute_email`
- `evidence_timeline`
- `rti_draft`
- `journalist_digest`
- `infographic_copy`

### DashboardAlert

Fields:

- `id`
- `clusterId`
- `audience`
- `title`
- `summary`
- `severity`
- `createdAt`
- `isPublic`

### MockIntegrationEvent

Fields:

- `id`
- `adapter`
- `operation`
- `requestSummary`
- `responseSummary`
- `status`
- `createdAt`

Use this for demo transparency. The UI may show "Simulated for demo" in admin
or developer surfaces, but victim-facing emergency flows should not be cluttered
with implementation disclaimers.

## 6. Design System and UX Direction

Use the local taste-skill direction from:

- `.agents/skills/design-taste-frontend/SKILL.md`

Design read:

> Public-sector emergency service product for Indian citizens, trust-first,
> professional, accessible, calm, and operational.

Design dials:

- Design variance: 3 to 4.
- Motion intensity: 2 to 3.
- Visual density: 5.

### Visual language

- Government-grade, not startup-glossy.
- Calm and official, not dramatic except in Emergency Mode.
- Dense enough for repeated use, but never visually cramped.
- Clear hierarchy, strong typography, high contrast.
- Avoid generic AI aesthetics, purple-blue gradients, glassmorphism, bokeh
  blobs, decorative orbs, dark-tech hacker visuals, and overanimated cards.

### Palette

Use a neutral base with restrained status accents:

- Background: off-white or very light neutral.
- Text: near-black ink.
- Surfaces: white and light grey.
- Primary action: deep blue or deep teal.
- Warning/action accent: restrained saffron.
- Emergency only: red.
- Success: green, used sparingly.

Do not create a one-hue UI. Do not make the entire product blue, purple, beige,
or dark slate.

### Typography

- Use a professional sans-serif such as Inter, Geist, IBM Plex Sans, or Noto
  Sans. Public-sector accessibility is more important than decorative novelty.
- Use Indian-language capable fallback fonts.
- Do not use serif display type.
- Do not use oversized landing-page hero typography inside product flows.
- Keep labels short, direct, and readable under stress.

### Components

Create reusable components for:

- App shell (desktop sidebar + mobile bottom nav + top bar).
- Emergency banner (red used only here, never in chrome).
- Intake composer (text / SMS / screenshot / voice input modes).
- Evidence uploader.
- Extracted-field review table.
- Countdown timer.
- Call script panel (Hindi + English tabs, "do not share" reminder).
- Step checklist.
- Editable document editor (with copy / download / print / share actions).
- Probability band (recovery as a range, never a single number).
- Similarity result panel.
- Heatmap panel (real India choropleth, state drilldown, accountability
  flag overlay).
- Cluster alert card (active / monitor state).
- Digest / RTI / infographic preview panel.
- Public dashboard active-accountability-alert card.
- Journalist dashboard story-lead panel.
- Adaptive `InvestigationChecklist` (read workflow state from the
  Zustand store; visually marks completed steps and highlights the next).
- `EducationNote` card (post-action cool-down content).
- `ShareWithFamilySheet` (bottom sheet with pre-written warning text and
  a single "Send via WhatsApp" deep link).
- 5-step `WorkflowStepper` (Describe / Review / Act / Reference /
  Documents) with route-aware step mapping.
- Glass-panel utility class (frosted surfaces with
  `prefers-reduced-transparency` fallback).
- Empty, loading, error, offline, low-confidence, and completed states.

### Interaction rules

- No registration gate before emergency intake.
- Do not ask users to choose a fraud category first.
- Ask one thing at a time.
- Always show the next action.
- During Emergency Mode, hide non-essential navigation.
- Buttons must not wrap on desktop.
- Text must not overflow on mobile.
- CTAs must have WCAG AA contrast.
- Use icons for known actions, with labels where clarity matters.
- Use animation only for state transitions, not decoration.
- Use skeletons or shaped loading states instead of generic spinners where
  possible.

### Mobile and low-bandwidth behavior

- Mobile-first layouts.
- Emergency CTA, countdown, script, and extracted UTR/amount must be visible
  without awkward scrolling on common phone sizes.
- Design must work on low-end phones and 2G-like conditions.
- Offline or connection-loss state must preserve draft progress locally.

## 7. Core User Flows

### Flow A: Financial fraud under 60 minutes

1. Victim opens app.
2. Victim describes event by voice/text or uploads/pastes SMS.
3. Urgency engine extracts amount, incident time, payment method, and fraud
   type.
4. Route to Golden Hour.
5. Emergency Mode appears.
6. Victim sees "Call 1930 Now", countdown, and prepared script.
7. Victim sees extracted UTR, UPI ID, amount, timestamp, and bank/app.
8. Victim enters helpline reference number after call.
9. System generates NCRP complaint draft, bank dispute email, evidence
   timeline, and next-step checklist.
10. Similarity engine checks seeded data.
11. Victim dashboard stores status and reminders.

### Flow B: Financial fraud after 60 minutes

1. Victim describes event or uploads evidence.
2. Route to Post-Golden-Hour.
3. OCR/NER mock extracts transaction facts.
4. Victim reviews and edits extracted facts.
5. System shows honest recovery probability band.
6. System generates NCRP draft, bank email, evidence timeline, and checklist.
7. Similarity engine shows matching seeded complaints.
8. Victim sees education note after the main action package is complete.

### Flow C: Non-financial cybercrime

1. Victim describes sextortion, harassment, account hack, job scam, or related
   cybercrime.
2. Route to Post-Golden-Hour or Fall-Back depending on confidence.
3. System gives category-specific government-service guidance.
4. System generates complaint draft and investigation checklist.
5. Similarity and cluster data are added where identifiers exist.

### Flow D: Fall-Back edge case

1. Case is low confidence or multi-type.
2. Fall-Back Agent asks guided clarifying questions.
3. If fresh financial fraud is discovered, reroute to Golden Hour.
4. Otherwise collect evidence and generate complaint material.
5. Log as training candidate for future structured pipeline expansion.

### Flow E: Accountability trigger

1. Seeded reports include a pattern with at least 50 unresolved complaints.
2. Cluster monitor detects threshold.
3. System confirms no mock FIR/resolution exists.
4. Accountability Alert is created.
5. Public dashboard shows anonymized cluster.
6. Journalist dashboard shows digest.
7. RTI draft and infographic copy are generated from cluster fields.
8. Victims in the cluster receive notification text.

## 7.2 Post-MVP / Out of Scope for Hack4SOC Demo

The following are part of the long-form product vision but are **not** in
the hackathon demo. They may appear as disabled, "coming next", or
simulation-only affordances only when required for context. They must not
pretend to be fully functional in V1.

- **M11 — Full 10-language Voice Assistant.** Indian languages covered:
  Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati,
  Odia, Punjabi. The intake composer exposes a "Voice (stub)" tab that
  simulates listening. STT for distressed speech is post-MVP.
- **M12 — WhatsApp Bot.** Real WhatsApp Business API integration via the
  Meta India gateway is post-MVP. For V1, the intake composer exposes a
  "Paste Messages" affordance that treats forwarded WhatsApp text as
  evidence, and the integration router has a `whatsapp/simulate` mock
  for demo transparency.
- **Police dashboard with live jurisdiction data.** The current
  police dashboard is a jurisdiction-filtered demo over the seed DB.
  Real onboarding, real authentication, and live jurisdictional
  wiring are post-MVP.
- **Live STT, TTS, or any real model wiring.** Everything is
  deterministic. The recovery model is a rule-based band, **not**
  XGBoost trained on I4C stats. The similarity engine is regex +
  exact-match, **not** embeddings. The clusterer is deterministic,
  **not** HDBSCAN in production. These are honest mock adapters with
  clean replacement interfaces for later.

## 7.3 Reliability Budgets (Demo Targets)

| Surface | Target | Measurement |
|---|---|---|
| Golden Hour Engine response (routing + extraction) | ≤ 3 s | API timing in `e2e-priya.ts` |
| Mock OCR processing | ≤ 10 s | API timing in `browser-smoke.ts` |
| NCRP / bank email / evidence timeline generation | ≤ 15 s | API timing in `e2e-refresh.ts` |
| First contentful paint (intake) on simulated 2G | graceful skeleton, never blank | Playwright check |
| Public dashboard load with 500+ seed complaints | no layout shift on filter change | Playwright check |

These are demo targets, not production SLAs. They are here so the
golden-hour and document-generation paths stay snappy. They do **not**
override the deterministic-mock constraint.

## 7.4 Privacy Posture

- No Aadhaar, PAN, OTP, bank password, card PIN, full card number, or
  netbanking credential is ever stored or displayed (see §10).
- Evidence files are redacted at ingestion; the only exception is
  transient local parsing during redaction.
- All inference in V1 runs on local infrastructure. **No data leaves
  the user's device for inference.** Demo data lives in seed fixtures.
- The system is designed to be **DPDP Act 2023 compliant** when
  deployed: minimal data collection, explicit consent flags per
  session, anonymized public output, no cross-session profiling.
- Journalists and researchers receive only anonymized exports
  (no victim identities, no full phone numbers, no raw screenshots,
  no unredacted bank details).
- Police access is gated and audited (post-MVP).

## 8. Demo Scenarios and Seed Data

### Primary scenario: Priya

Priya says:

> Mujhe lag raha tha warden hai. Usne bola fees bharo Google Pay se. Maine
> bhar diya. Ab number band hai.

Expected extracted facts:

- Fraud type: UPI/payment fraud.
- Amount: Rs 2,500.
- Time since incident: 15 minutes.
- Payment method: UPI.
- UPI ID: from seed/sample evidence.
- Route: Golden Hour.
- Emergency copy: call 1930 now.
- Recovery band: moderate/high for demo, with no guarantee.

### Fall-Back scenario 1

Sextortion plus payment demand:

- Victim is threatened with private images.
- Scammer asks for UPI payment.
- System must not shame victim.
- System must say not to pay additional money.
- System must preserve evidence and route complaint material.

### Fall-Back scenario 2

Job scam:

- Victim made multiple small payments over several days.
- Golden Hour no longer applies.
- System builds timeline and bank/NCRP complaint package.

### Fall-Back scenario 3

Account hack:

- Victim cannot tell whether money was stolen.
- System asks clarifying questions.
- System routes to account recovery and complaint checklist.
- If payment evidence appears, reclassify as financial fraud.

### Seed data rules

- Include at least 500 seeded complaint records for heatmap and clustering.
- Include one cluster that crosses the accountability threshold.
- Include several non-trigger clusters for dashboard contrast.
- Similarity counts in UI must be computed from this seed data.
- Public dashboards must never show victim identity or raw evidence.

## 9. Document Generation Requirements

Generate these outputs after evidence review:

### NCRP complaint draft

Must include:

- Victim-editable incident narrative.
- Incident date/time.
- Fraud type.
- Amount.
- Transaction identifiers.
- Scammer identifiers.
- Evidence list.
- Steps already taken, including 1930 reference number if available.

### Bank dispute email

Must include:

- Formal subject.
- Victim-editable body.
- Transaction details.
- UTR/reference number.
- Request for transaction hold, investigation, and written response.
- No fake legal citations unless verified.

### Evidence timeline

Must include:

- Chronological events.
- Evidence item references.
- Extracted metadata.
- Redacted sensitive information.
- Download/export UI.

### RTI draft

Must include:

- Relevant authority based on cluster geography.
- Cluster summary using aggregate data only.
- Questions about action taken, FIR status, coordination, and pending
  complaints.
- No victim-identifiable details.

### Journalist digest

Must include:

- Cluster count.
- Total reported amount.
- Geography.
- Common identifiers, redacted where needed.
- Time range.
- Why the pattern triggered.
- Source note: demo seed data in MVP.

### Infographic copy

Must include:

- Title and subtitle derived from the cluster.
- Key tiles: report count, district count, total amount, first / latest
  report.
- One short pull quote.
- Footer with the deterministic-seed data source note.

### Victim notification

Must include:

- Plain statement that the case is part of an escalated pattern.
- Counts only (no victim identities).
- Pointer to the journalist digest, the RTI draft, and the 1930 helpline.
- No advice to pay, no recovery guarantee, no shame.

### Recovery workflow checklist

Must include:

- Numbered steps in the Indian escalation order: 1930 → bank hold →
  NCRP → bank dispute email → 3-day follow-up → 7-day police visit →
  state consumer forum if unresolved.
- Recovery outlook (range + factors, not a single number).
- Honest "no guarantee" copy.

### Family alert message

Must include:

- Pre-written Hindi + English text the victim can forward to family.
- WhatsApp `wa.me` deep link with the text pre-filled.
- Visible only on the Documents page once drafts are generated, and
  inside the `ShareWithFamilySheet` triggered by the Education note.

## 10. Privacy, Safety, and Compliance Rules

### Storage

Never store:

- Aadhaar.
- PAN.
- OTPs.
- Bank passwords.
- Card PINs.
- Full card numbers.
- Netbanking credentials.

If such values appear in text or screenshots, redact them before storage and
display. The only exception is transient local parsing during redaction.

### Public output

Public, journalist, and researcher surfaces must be anonymized:

- No names.
- No phone numbers unless redacted or aggregated.
- No exact street addresses.
- No raw screenshots.
- No unredacted bank details.

### Safety language

The app must:

- Never guarantee recovery.
- Never advise paying scammers.
- Never impersonate police or a government authority.
- Clearly separate generated drafts from official submission confirmation.
- Tell users to use official portals/helplines for final submission.
- Keep language calm and non-blaming.

### Distress handling

For sextortion, harassment, and high-distress cases:

- Use supportive, non-judgmental language.
- Prioritize immediate safety.
- Preserve evidence guidance.
- Avoid visible shame-inducing labels.

## 11. Suggested File Organization

Use this shape unless the chosen framework requires small adjustments.
The repo currently uses this layout:

```text
apps/web/
  app/
    page.tsx              # intake — first screen, emergency command surface
    emergency/            # Golden Hour page
    documents/            # Complaint package page
    accountability/       # Accountability engine page
    fall-back/            # Fall-Back guided flow page
    dashboards/
      public/             # Public anonymised dashboard
      police/             # Police jurisdiction demo
      journalist/         # Journalist / researcher demo
      heatmap/            # Fraud heatmap with district drilldown
    demo/                 # Judge demo
    layout.tsx
    globals.css           # Tailwind v4 + shadcn radix-nova tokens
  components/
    ui/                   # shadcn radix-nova primitives
    app/                  # app-specific shared components (PageHeader, StatusBadge,
                          #   WorkflowStepper, AppShell in some refactors, EmptyState,
                          #   DataPanel, MetricCard, CaseSummaryCard, etc.)
    intake/               # IntakeComposer + scenario chips
    emergency/            # EmergencyClient (Golden Hour cockpit)
    documents/            # DocumentPackage + InvestigationChecklist + EducationNote
                          #   + ShareWithFamilySheet (F005/F008)
    dashboards/           # Public/Police/Journalist + IndiaHeatmap
    accountability/       # AccountabilityClient
    fall-back/            # FallBackClient (owned by Akshay/F007)
    evidence/             # evidence uploader (owned by Akshay/F008)
    demo/                 # JudgeDemo
  lib/
    api.ts                # typed HTTP client
    workflow-store.ts     # Zustand session/case store (persists draft)
    types/                # mirrors Pydantic models
    utils.ts              # cn() and shadcn helpers
    maps/                 # vendored India TopoJSON
  hooks/
  styles/                 # tailwind entry, globals.css via app/
  tests/                  # Playwright + tsx E2E scripts

apps/api/
  app/
    main.py               # FastAPI app, CORS, /healthz, lifespan
    routers/              # intake, complaints, evidence, similarity, clusters,
                          #   dashboards, fall_back, integrations
    services/             # routing, extraction, recovery, similarity, clusters,
                          #   documents, fall_back, intelligence_map, redaction,
                          #   integrations, database, db_store, seed_loader,
                          #   intake
    models/               # Pydantic models, SQLAlchemy tables
    seed/                 # seed_postgres.py, __main__
    repositories/         # per-table SQLAlchemy repos
    tests/                # pytest suite
  alembic/                # migrations
  run_api.py              # local launcher

packages/shared/
  constants.py            # FRAUD_TYPES, PIPELINES, PUBLIC_AUTHORITIES,
                          #   ACCOUNTABILITY_THRESHOLD, GOLDEN_HOUR_MINUTES
  pyproject.toml
```

Domain boundaries must stay clear:

- `components/ui/` is for shadcn primitives only; F005 customisation
  goes into `components/app/`.
- `components/evidence/` is owned by F008; F005 may add visual
  surface but not persistence.
- `apps/web/lib/` holds typed clients and stores only; business logic
  lives in `apps/api/`.
- `packages/shared/` is the only place both frontend and backend can
  import constants or types.

## 12. MVP Acceptance Criteria

The MVP is acceptable only when all of these pass:

- User can start from "What happened?" without registration.
- Text/SMS sample for Priya routes to Golden Hour.
- Golden Hour UI shows call CTA, countdown, script, extracted facts, and
  reference-number capture.
- After reference capture, system generates editable NCRP draft, bank dispute
  email, and evidence timeline.
- A post-60-minute fraud routes to Post-Golden-Hour without emergency mode.
- Recovery probability is a range with explanation, not a guaranteed result.
- Similarity count is computed from seed data.
- Heatmap uses seeded anonymized reports.
- Accountability trigger creates public alert, journalist digest, infographic
  copy, and RTI draft.
- Public dashboard surfaces the active accountability alert at the top of
  the page (not in a sub-route).
- Journalist dashboard shows a story lead panel from pattern data at the
  top of the page.
- Adaptive `InvestigationChecklist` is present on the Documents page and
  reflects captured state (1930 called, bank notified, NCRP filed).
- `EducationNote` appears on the Documents page after documents are
  generated; `ShareWithFamilySheet` opens from a `Share with family`
  affordance and pre-fills a WhatsApp deep link.
- Documents page renders as a clean print/PDF view via `window.print()`
  with a print stylesheet (no extra route required).
- Fall-Back flow handles the 3 scripted edge cases.
- Aadhaar/PAN/OTP-like values are redacted in evidence text.
- Mobile layout keeps emergency CTA and key script usable on small screens.
- Loading, empty, error, offline, low-confidence, and completed states exist.
- No real official APIs are called.
- Reliability budgets in §7.3 are met on the seeded dataset.
- All inference runs on local infrastructure; no data leaves the device
  for inference. DPDP Act posture in §7.4 holds.

## 13. Verification Commands

After making documentation or code changes, run relevant non-destructive
checks. For documentation work, verify:

```bash
rg --files
test -f AGENTS.md
test ! -f IMPLEMENTATION.md
test ! -f IMPLEMENTATION_nandan.md
test ! -f CyberSaathi_Final_Implementation.pdf
rg "Product Definition|Technical Stack|Core User Flows|Data Model|MVP Acceptance Criteria|Design System" AGENTS.md
```

For app implementation work, run whichever of these exist in the
repository:

```bash
cd apps/api && PYTHONPATH=.:../.. uv run pytest
cd apps/web && npm run typecheck && npm run lint && npm run build
npx tsx tests/browser-smoke.ts
npx tsx tests/e2e-priya.ts
npx tsx tests/e2e-fall-back.ts
npx tsx tests/e2e-golden-hour-bilingual.ts
npx tsx tests/e2e-refresh.ts
```

Only list commands that exist in the repository.

## 14. Agent Behavior Rules

When building from this file:

- Build the actual usable product flow first.
- Do not create a marketing landing page as the first screen.
- Keep implementation deterministic unless real model wiring is explicitly
  requested.
- Use simulated adapters for official systems.
- Keep UI public-sector professional and accessible.
- Avoid AI-purple gradients, decorative blobs, dark-tech dashboards, and
  generic chatbot framing.
- Preserve Team AETOS and CyberSaathi identity.
- Do not introduce new scopes, emergency categories, or real integrations
  without explicit instruction.
- When in doubt, choose the path that helps a panicking victim complete the
  next official action fastest.
- The visual design pack at
  `cybersaathi_final_design_agent_pack/CYBERSAATHI_AI_AGENT_DESIGN_HANDOFF.md`
  is **inspiration only**. It provides composition, spacing, polish, and
  mobile shell direction. Do not copy fake text, fake service categories,
  or its marketing-first premise. AGENTS.md product rules always win.
- For any Next.js App Router work, read the version-matched installed
  Next.js docs before editing. If `node_modules/next/dist/docs/` is
  missing, run `npx @next/codemod@latest agents-md` once to generate
  `.next-docs/`, then read the generated docs. Never rely on
  training-data App Router behaviour for a 15.x codebase.
- File ownership rules in `team/STATUS.md` are enforced. Do not silently
  edit another builder's owned files; if a feature needs it, add a note
  in the feature's block first and get explicit approval.
