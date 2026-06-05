# CyberSaathi Final UI Design Handoff for AI Coding Agent

## Purpose

Build CyberSaathi as a calm, minimal, emergency-first government-service web app for cybercrime victims in India. The app must feel serene, trustworthy, and guided, not like a generic SaaS dashboard or marketing landing page.

The attached images in `images/` are the final visual direction references. Use them as layout and visual inspiration, but implement the actual UI using clean React/Next.js components, real responsive behavior, accessible markup, and reusable design tokens.

## Product Principle

CyberSaathi is not a chatbot and not a generic cyber dashboard. It is a guided emergency protocol flow.

The first screen is the product. It asks:

> What happened?

The app should help a stressed user move through one next action at a time:

1. Describe the incident.
2. Add evidence.
3. Review extracted facts.
4. Route to Golden Hour or post-golden-hour recovery.
5. Capture 1930 reference if applicable.
6. Generate complaint package.
7. Track case progress.
8. Show similarity and accountability insights.

Do not show everything on one page. Avoid dense dashboards except where the user intentionally opens Insights.

---

# 1. Visual Direction

## Mood

- Calm
- Serene
- Official
- Helpful
- Trustworthy
- Premium but not flashy
- Indian public-service ready
- Modern Next.js / shadcn quality
- Implementable glass UI, not fantasy glassmorphism

## Visual Keywords

- baby sky blue
- clean frosted glass
- soft depth
- lake / mist / open-air background feeling
- gentle white translucent panels
- deep blue primary action
- emergency red only for urgent Golden Hour states
- one task per screen
- generous whitespace
- readable under stress

## Avoid

- generic admin dashboard feeling
- cluttered analytics panels on the home screen
- purple AI gradients
- dark hacker/cyberpunk visuals
- neon glows
- overused startup SaaS cards
- decorative blobs everywhere
- fake 3D dashboards
- too many CTAs on one screen
- marketing hero sections
- unrestricted chatbot framing

---

# 2. Theme Tokens

Use CSS variables so this can be implemented with Tailwind CSS v4 and shadcn/ui.

```css
:root {
  /* Base */
  --background: #eef8ff;
  --background-soft: #f7fbff;
  --foreground: #071a33;
  --muted-foreground: #5e7089;

  /* Sky glass palette */
  --sky-25: #f8fcff;
  --sky-50: #eef8ff;
  --sky-100: #dff1ff;
  --sky-200: #c8e6ff;
  --sky-300: #9ed1ff;
  --sky-400: #65b3ff;
  --sky-500: #1f7eea;
  --sky-600: #075fd1;
  --sky-700: #084ba3;
  --sky-800: #083d7f;
  --sky-900: #082f60;

  /* Ink */
  --ink-900: #071a33;
  --ink-800: #102744;
  --ink-700: #203a5c;
  --ink-600: #405675;
  --ink-500: #61738c;

  /* Glass */
  --glass-bg: rgba(248, 252, 255, 0.68);
  --glass-bg-strong: rgba(255, 255, 255, 0.78);
  --glass-border: rgba(255, 255, 255, 0.72);
  --glass-border-muted: rgba(125, 169, 210, 0.28);
  --glass-shadow: 0 24px 80px rgba(20, 70, 120, 0.14);
  --glass-shadow-soft: 0 12px 32px rgba(20, 70, 120, 0.10);

  /* Actions */
  --primary: #075fd1;
  --primary-hover: #084ba3;
  --primary-foreground: #ffffff;

  /* Emergency */
  --emergency: #e63930;
  --emergency-soft: #fff1f0;
  --emergency-border: #ffd2ce;

  /* Status */
  --success: #168456;
  --success-soft: #eaf8f2;
  --warning: #d8911f;
  --warning-soft: #fff7e8;
  --info: #1f7eea;
  --info-soft: #eef7ff;

  /* Radius */
  --radius-sm: 12px;
  --radius-md: 18px;
  --radius-lg: 26px;
  --radius-xl: 34px;
  --radius-2xl: 44px;

  /* Layout */
  --sidebar-width: 260px;
  --content-max: 1120px;
  --mobile-bottom-nav-height: 72px;
}
```

## Tailwind Utility Intent

Use utilities like:

```tsx
className="bg-[rgba(248,252,255,0.68)] backdrop-blur-xl border border-white/70 shadow-[0_24px_80px_rgba(20,70,120,0.14)]"
```

Use glass carefully. Main panels should use glass; inner controls should often be plain white/semi-white so text stays readable.

---

# 3. Typography

Recommended:

- UI font: `Inter`, `Geist`, or `IBM Plex Sans`
- Indian-language fallback: `Noto Sans`, `Noto Sans Devanagari`
- Optional display font only for major page titles: a restrained serif such as `Newsreader` or `Instrument Serif`

Important: If the serif title style is used, use it only for page headings. Do not use decorative serif text inside forms, tables, action cards, or emergency scripts.

## Type Scale

```ts
const typography = {
  pageTitle: "text-4xl md:text-5xl tracking-[-0.04em] leading-[0.95] font-medium",
  sectionTitle: "text-xl md:text-2xl tracking-[-0.025em] font-semibold",
  cardTitle: "text-base md:text-lg font-semibold tracking-[-0.015em]",
  body: "text-sm md:text-base leading-6",
  bodySmall: "text-xs md:text-sm leading-5",
  caption: "text-xs leading-4 text-muted-foreground",
  button: "text-sm md:text-base font-medium",
}
```

---

# 4. Layout System

## Desktop Shell

Use a three-layer shell:

1. **Atmospheric background**: soft sky-blue lake/mist gradient or subtle abstract light background.
2. **Glass app frame**: rounded outer container with translucent background.
3. **Focused task content**: one main task per page.

Desktop shape:

```txt
┌───────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar + focused page content                       │
│         │                                                     │
│         │ Page title + stepper                                │
│         │ Main task panel                                     │
│         │ Secondary support panels, only when needed          │
└───────────────────────────────────────────────────────────────┘
```

## Mobile Shell

Mobile should feel like a native app:

- no desktop sidebar
- compact top icons
- bottom navigation
- sticky primary CTA at bottom where relevant
- keep emergency CTA visible in Golden Hour
- avoid large tables on mobile

---

# 5. Navigation

## Desktop Sidebar Items

Keep the sidebar minimal:

- Intake
- Cases
- Evidence
- Documents
- Guidance
- Insights
- Support / AI Saathi when needed

During Golden Hour, make the emergency state dominant. The sidebar can remain, but visually quieter.

## Mobile Bottom Nav

Use 5 items maximum:

- Intake
- Cases
- Evidence
- Guidance
- More

For Golden Hour, replace the active item with `Guidance` or show an emergency mini-state.

---

# 6. Component System

Create these app components under something like `apps/web/components/app/`.

## Shell Components

### `AppBackground`

Purpose: creates the serene baby-blue atmosphere.

Requirements:
- soft sky/lake gradient
- subtle noise optional
- should not hurt text contrast
- can use a CSS gradient instead of image assets

Suggested CSS:

```css
.app-background {
  background:
    radial-gradient(circle at 20% 12%, rgba(180, 222, 255, 0.7), transparent 32%),
    radial-gradient(circle at 90% 18%, rgba(255,255,255,0.85), transparent 28%),
    linear-gradient(180deg, #eaf7ff 0%, #f8fcff 45%, #e6f5ff 100%);
}
```

### `GlassAppFrame`

Outer desktop app frame.

- radius: 32-44px
- backdrop blur: 18-28px
- white border
- subtle shadow
- max-width around 1440px
- min-height around 860px on large desktop

### `SidebarNav`

- translucent panel
- active item has subtle blue-filled pill
- icons from lucide-react only
- no mixed icon families

### `TopBar`

- user greeting
- Emergency SOS pill
- notification icon
- avatar/menu
- keep clean and sparse

### `MobileTopBar`

- small logo shield
- notification
- menu icon
- no heavy branding text unless there is room

### `MobileBottomNav`

- fixed bottom
- frosted glass
- safe-area padding
- active blue icon and label

---

## Core Journey Components

### `StepProgress`

Shows current stage in the guided journey.

Variants:
- desktop horizontal dots with label
- mobile compact step pill + progress line

Recommended journey states:

```ts
const journeySteps = [
  { id: "incident", label: "Incident" },
  { id: "evidence", label: "Evidence" },
  { id: "review", label: "Review" },
  { id: "action", label: "Action" },
  { id: "package", label: "Package" },
]
```

Important: do not hardcode conflicting step numbers per route. Use a single route-aware step model:

- Golden Hour path: Incident -> Evidence -> Emergency Action -> Reference -> Package
- Post-golden-hour path: Incident -> Evidence -> Review -> Recovery Outlook -> Package

### `IntakeComposer`

Main “What happened?” panel.

Requirements:
- big textarea
- voice icon button
- attachment icon button
- character count
- examples chips below
- one primary CTA: Continue
- no registration gate

### `EvidenceMethodCard`

Cards for:
- upload screenshot/image
- paste SMS/chat message
- drag/drop files
- forward copied text
- voice note optional

### `EvidenceDropzone`

- large centered drop area on desktop
- smaller upload cards on mobile
- file type notes
- privacy note
- recent files strip

### `ExtractedFactRow`

For OCR/NER review:
- icon
- label
- extracted value
- edit button
- confidence status

Fields:
- fraud type
- amount
- UPI ID/account
- date/time
- bank/wallet
- phone number
- notes

### `ConfidenceBadge`

- high: green soft badge
- medium: blue/amber badge
- low: warning badge and ask user to confirm

### `PrivacyProtectionNote`

Small calm note:

> Sensitive details are masked or redacted before storage.

---

## Emergency Components

### `GoldenHourBanner`

Only use red here.

Requirements:
- alert icon
- “You are in the Golden Hour”
- countdown
- red primary CTA: Call 1930 Now
- short official helpline note

### `CountdownTimer`

- visible and large
- use accessible labels
- do not rely only on color

### `CallScriptCard`

Shows exact script the user can say:

> Hello, I need help. I have been a victim of financial fraud. I request you to register my complaint. Here are my details...

Do not guarantee recovery.

### `IncidentFactsCard`

Shows extracted emergency facts:
- amount lost
- UPI/account
- time of incident
- bank/app

### `HelplineReferenceForm`

After call:
- reference number input
- call notes textarea
- status chips: Call completed, Reported to 1930
- next action cards
- CTA: Continue to Complaint Package

---

## Recovery and Complaint Components

### `RecoveryOutlookCard`

Post-golden-hour probability band.

Important copy:

> This is an estimate, not a guarantee.

Show:
- Low / Moderate / Higher scale
- reason summary
- similar seeded reports found
- CTA to complaint package

### `NextActionList`

Recommended actions:
- File an NCRP complaint
- Notify your bank/payment app
- Preserve evidence
- Track updates

### `DocumentWorkspace`

Three-column desktop:

```txt
Document List | Editor / Preview | Actions
```

Mobile:

- document selector accordion
- preview card
- bottom action grid

Documents:
- NCRP Complaint Draft
- Bank Dispute Email
- Evidence Timeline
- RTI Draft when accountability alert exists

### `DocumentActionCard`

Actions:
- Export package
- Download PDF
- Copy content
- Share securely

### `EvidenceTimeline`

Still missing from images but must be implemented.

Suggested layout:
- chronological timeline
- each event has evidence source, extracted metadata, redaction status
- export as part of package

---

## Case and Intelligence Components

### `CaseTracker`

Shows case status without feeling like a dense admin dashboard.

Statuses:
- Complaint Submitted
- Under Review
- Sent to Bank
- Waiting for Action
- Closed

Use horizontal stepper desktop, vertical stepper mobile.

### `CaseListPanel`

Small list of cases with status chips.

Avoid large tables.

### `IndiaHeatmapCard`

- light blue map, not aggressive red/orange unless showing danger
- filters above: geography, category, time range
- aggregate-only data

### `SimilarityPatternList`

Shows matched scam patterns:
- UPI/payment fraud
- job scam
- social media impersonation
- investment fraud
- phishing/smishing

Include similarity percentage and location.

### `AccountabilityAlert`

For escalated patterns:
- cluster title
- report count
- amount involved
- states affected
- time range
- AI confidence
- RTI draft preview
- action cards

No victim-identifiable details.

---

# 7. Screen-by-Screen Implementation Guide

Use the image files as reference.

## 01 — Intake / What Happened

Reference: `images/01_intake_what_happened_desktop_mobile.png`

Purpose:
- first screen
- no marketing hero
- no login gate
- captures victim description

Build:
- page title: “What happened?”
- subcopy: “Describe the incident in your own words. Our AI will guide you to the right steps.”
- large `IntakeComposer`
- method cards: Write/Type, Voice Note, Screenshot, Paste Messages
- examples: UPI/Payment Fraud, Job Scam, Social Media Harassment, Account Hacked
- primary CTA: Continue to Next Step

## 02 — Add Evidence

Reference: `images/02_add_evidence_desktop_mobile.png`

Purpose:
- collect screenshots/messages/docs

Build:
- upload method cards
- drag/drop area
- recently added files
- privacy note
- CTA: Continue to Review

## 03 — Evidence Review & Fact Extraction

Reference: `images/03_evidence_review_fact_extraction_desktop_mobile.png`

Purpose:
- show OCR/NER extracted facts
- allow user to edit before continuing

Build:
- uploaded evidence preview carousel/list
- extracted facts panel
- edit buttons on every row
- confidence badge
- CTA: Confirm Facts

## 04 — Golden Hour Guidance

Reference: `images/04_golden_hour_guidance_desktop_mobile.png`

Purpose:
- emergency action when financial fraud is within 60 minutes

Build:
- emergency red banner
- countdown
- Call 1930 Now CTA
- call script
- incident facts
- follow these steps cards

Critical:
- red only here
- keep CTA visible on mobile
- never promise recovery

## 05 — Helpline Reference Capture

Reference: `images/05_helpline_reference_capture_desktop_mobile.png`

Purpose:
- after user calls 1930, capture reference number and notes

Build:
- reference number input
- notes field
- calm success/security illustration area optional
- next-action cards
- CTA: Continue to Complaint Package

## 06 — Recovery Outlook & Next Actions

Reference: `images/06_recovery_outlook_next_actions_desktop_mobile.png`

Purpose:
- post-golden-hour probability and action plan

Build:
- probability band
- “estimate, not guarantee” note
- action list
- similar seeded reports count
- CTA to complaint package

## 07 — Complaint Package & Documents

Reference: `images/07_complaint_package_documents_desktop_mobile.png`

Purpose:
- review and export generated official complaint material

Build:
- document list
- main document editor/preview
- actions panel
- mobile accordion document selector
- export/download/copy/share actions

Documents:
- NCRP complaint draft
- Bank dispute email
- Evidence timeline

## 08 — Case Tracker

Reference: `images/08_case_tracker_desktop_mobile.png`

Purpose:
- track complaint progress

Build:
- case list
- selected case status
- progress stepper
- next action panel
- reminder panel

## 09 — Insights & Similarity

Reference: `images/09_insights_similarity_heatmap_desktop_mobile.png`

Purpose:
- show aggregate intelligence, heatmap, scam similarity

Build:
- filters
- India heatmap
- similar scam pattern list
- accountability insight banner

Rules:
- no victim identity
- aggregate-only public data

## 10 — Accountability Alert / RTI

Reference: `images/10_accountability_alert_rti_desktop_mobile.png`

Purpose:
- escalated repeated scam pattern
- generate RTI draft / public alert

Build:
- escalated pattern card
- report count, amount involved, states affected, time range
- AI confidence
- RTI draft preview
- action cards: Generate RTI Draft, View Cluster Details, Share Public Alert

---

# 8. Required Additional Screens Not In Image Pack

The image pack covers the main happy path. Also implement these states with the same design language:

## Empty States

- No cases yet
- No evidence uploaded
- No similar reports found
- No documents generated yet

Use calm icon, one sentence, one CTA.

## Loading States

- extracting evidence
- generating documents
- checking similarity
- loading heatmap

Use skeleton glass cards, not spinners when possible.

## Error States

- upload failed
- extraction failed
- backend offline
- document generation failed

Always preserve user input locally.

## Low-Confidence Extraction State

Show:
- amber confidence badge
- “Please review these fields carefully”
- missing/uncertain rows highlighted gently

## Offline / Saved Locally State

Show:
- small top/bottom banner
- “You are offline. Your draft is saved on this device.”

## Completed Case Summary

Show:
- documents generated
- official submission checklist
- next reminder
- what to preserve

## Bilingual Variant

Support Hindi/Hinglish copy for stress-state UX. Layout must not break with longer text.

---

# 9. Accessibility Requirements

- WCAG AA contrast minimum.
- Focus-visible states on all controls.
- Keyboard accessible navigation.
- No information conveyed by color only.
- Emergency countdown must have accessible label.
- Buttons must not wrap awkwardly on desktop.
- Text must not overflow on mobile.
- Touch targets minimum 44px.
- Respect `prefers-reduced-motion`.

---

# 10. Motion Guidelines

Use motion lightly:

- page transitions: 150-220ms
- cards fade/slide subtly
- stepper progress animates gently
- no bouncing, no dramatic AI animations
- emergency mode should feel urgent but controlled

Framer Motion is okay, but CSS transitions are enough.

---

# 11. Implementation Notes for Next.js / React

Recommended structure:

```txt
apps/web/
  app/
    page.tsx
    intake/page.tsx
    evidence/page.tsx
    review/page.tsx
    golden-hour/page.tsx
    reference/page.tsx
    recovery/page.tsx
    documents/page.tsx
    cases/page.tsx
    insights/page.tsx
    accountability/page.tsx
  components/
    app/
      shell/
      journey/
      intake/
      evidence/
      emergency/
      recovery/
      documents/
      cases/
      insights/
      accountability/
    ui/
  lib/
    design-tokens.ts
    journey.ts
    mock-data.ts
```

Use server components for static shells and client components for forms, upload state, timers, editor state, and interactive progress.

---

# 12. Copy Rules

## Tone

- calm
- direct
- non-blaming
- official but human
- short sentences

## Say

- “We’ll guide you through the next step.”
- “Reporting quickly may improve fund-blocking chances.”
- “This is an estimate, not a guarantee.”
- “Your information is private and secure.”

## Do Not Say

- “We will recover your money.”
- “Your case has been officially submitted” unless it truly has.
- “AI solved it.”
- “Don’t worry” in a dismissive way.
- Anything that impersonates police/government action.

---

# 13. Safety and Privacy Rules

Never store or display:

- Aadhaar
- PAN
- OTPs
- passwords
- full card numbers
- bank PINs
- full bank credentials

Redact before display or persistence.

Public, journalist, and insight surfaces must be aggregate-only.

No real calls to 1930, NCRP, banks, police, WhatsApp, RTI, or government systems in the alpha. All official integrations are simulated/mock adapters.

---

# 14. Build Priority

Build in this order:

1. App shell and theme tokens
2. Intake screen
3. Evidence upload screen
4. Evidence review screen
5. Golden Hour guidance
6. Helpline reference capture
7. Recovery outlook
8. Complaint package documents
9. Case tracker
10. Insights and similarity
11. Accountability alert
12. Empty/loading/error/offline states
13. Bilingual polish
14. Accessibility QA
15. Responsive QA

---

# 15. Final Acceptance Checklist

The build is acceptable when:

- first screen asks “What happened?”
- no registration before intake
- UI uses the baby sky blue glass theme
- layout feels calm and sparse, not dense
- each page has one dominant task
- desktop and mobile both work
- Golden Hour CTA is visible and urgent
- red is used only for emergency states
- evidence extraction can be reviewed and edited
- complaint package includes NCRP draft, bank email, evidence timeline
- recovery outlook says estimate, not guarantee
- case tracker shows clear progress
- insights show aggregate-only heatmap and similarity
- accountability alert can generate RTI draft preview
- no sensitive data is exposed
- keyboard and screen-reader basics work
- all screens are implementable with real CSS, Tailwind, shadcn/ui, and React components
