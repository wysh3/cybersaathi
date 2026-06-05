# CYBERSAATHI — IMPLEMENTATION PLAN
**HACK4SOC 3.0 · Governance PS1 · Team AETOS**

> Maintainer note, 2026-06-05: this file is historical/source material. It
> preserves the full product idea so features are not forgotten, but it is not
> the live coding contract. `AGENTS.md` controls product behavior and
> `team/STATUS.md` controls current work. If this file conflicts with AGENTS,
> follow AGENTS.

---

## SECTION 1 — WHAT WE ARE BUILDING (SCOPE DEFINITION)

CyberSaathi is an AI-powered cybercrime victim response and accountability platform. It is **NOT** a chatbot. It is **NOT** a helpline directory. It is a victim-state engine that detects where a victim is in the crisis timeline and gives them exactly what they need at that moment.

### The platform has four user types:
* **Victims** (primary)
* **Police / Law Enforcement**
* **Journalists / Researchers**
* **General Public**

### The platform is NOT:
* Filing FIRs on behalf of users
* Guaranteeing money recovery
* Acting as antivirus or fraud detection software
* Replacing banks or police
* Performing criminal investigations

---

## SECTION 2 — CORE MODULES (BUILD ORDER)

### MODULE 1 — Urgency Engine (Foundation, build first)
* **Purpose:** Every complaint that enters the system must be classified before anything else happens. This is the router.
* **Logic:**
    * Take input (voice / text / screenshot / WhatsApp message)
    * Extract: time of incident, fraud type, amount, severity
    * Compute urgency score from these four factors
    * Route to one of three pipelines:
        * → Golden Hour Engine (if < 60 minutes, financial fraud)
        * → Post-Golden Hour (if ≥ 60 minutes, all types)
        * → Fall-Back AI Agent (if unclassifiable)
* **Inputs:** Raw user input in any supported form
* **Output:** Urgency score + pipeline assignment

### MODULE 2 — Golden Hour Engine
* **Purpose:** When financial fraud is detected within 60 minutes, every second matters. The UI goes into emergency mode.
* **What it does:**
    * Switch UI to Emergency Mode (red interface, single CTA)
    * Single action surfaced: Call 1930
    * Auto-extract from user input: UTR number, UPI ID, amount
    * Capture reference number from 1930 call for tracking
* **Call Co-Pilot (sub-feature within Golden Hour):**
    * Pre-call: Prepares the victim with exactly what to say
    * During call: Checklist visible on screen
    * Post-call: Captures outcome + reference number + next steps
* **Implementation notes:**
    * Auto-extraction of UTR / UPI ID must work from typed text **AND** from pasted SMS content
    * Reference number field must be manually enterable (victim writes it down during call and enters after)

### MODULE 3 — Post-Golden Hour Pipeline
* **Purpose:** For complaints that come in after the golden window, the focus shifts from blocking funds to building a case.
* **Steps in this pipeline:**
    1.  Screenshot / SMS / document intake
    2.  OCR extracts: UTR, amount, date, bank name, UPI ID
    3.  NER tags Indian PII: Aadhaar numbers, phone numbers, UPI handles — for evidence tagging, **NOT** storage
    4.  Recovery probability shown to victim (honest, not hopeful)
    5.  Auto-draft generated for:
        * a. NCRP complaint (pre-filled, editable)
        * b. Bank dispute email (pre-filled, editable)
        * c. Evidence PDF (compiled, downloadable)
* **Implementation notes:**
    * OCR must handle low-quality screenshots (cropped, blurry)
    * All PII tagging is for display and complaint-filling only
    * Recovery probability uses XGBoost trained on I4C stats — show as a range (e.g. "15–25% chance") not a single number
    * All generated documents must be editable before export

### MODULE 4 — Fall-Back AI Agent
* **Purpose:** Handle what the structured pipelines cannot classify. Novel scam types, multi-type fraud, high-distress cases, unstructured descriptions that don't fit patterns.
* **What it does:**
    * Receives cases that urgency engine cannot classify
    * Runs full tool access: OCR, complaint gen, routing
    * Has access to same tools as the pipelines but uses LLM reasoning to decide how to apply them
    * Handles edge cases with open-ended conversation
* **Important:**
    * Every case handled by the Fall-Back Agent is logged as a training candidate for improving the main pipelines
    * The agent should not feel like a chatbot to the user — it should feel like the same product, just slower

### MODULE 5 — Evidence & Complaint Generation (shared layer)
* **Purpose:** Central document generation system used by both Post-Golden Hour Pipeline and Fall-Back Agent.
* **Documents generated:**
    1.  **NCRP Complaint Draft**
        * Fills standard NCRP format
        * Inserts: Victim info, fraud type, amount, UTR, scammer identifiers, timeline, evidence list
        * Editable by victim before submission
        * Exported as PDF and plain text
    2.  **Bank Dispute Email**
        * Formal format addressed to bank's nodal officer
        * References transaction IDs and relevant RBI circulars
        * Editable before sending
    3.  **Evidence PDF**
        * Compiled screenshots (uploaded by victim)
        * Extracted metadata from screenshots
        * Scammer identifiers (UPI ID, phone, account)
        * Timeline of events
        * Complaint reference number (if 1930 was called)
* **Implementation notes:**
    * All three documents generated in one step after intake
    * Victim can edit any section before downloading
    * Aadhaar / PAN should **NOT** be stored anywhere — if present in screenshots, redact before storing evidence

### MODULE 6 — Scam Similarity Engine
* **Purpose:** Cross-reference reported identifiers against the entire complaints database. Show victims and police how many others were hit by the same scammer.
* **What it matches:**
    * Phone numbers (exact + fuzzy)
    * UPI IDs (exact + fuzzy)
    * Scam message text (similarity match, not exact)
    * Social media handles
    * Bank account numbers
* **Output for victim:**
    * "32 other users reported the same UPI ID."
    * "This phone number appears in 14 complaints from Delhi."
* **Output for police dashboard:**
    * Full cluster view with linked reports
    * Map of geographic spread
    * Timeline of first report to latest report
* **Implementation notes:**
    * Fuzzy matching handles slight variations in phone/UPI (scammers change last digits, add country codes, etc.)
    * Similarity matching on scam message text needs to catch rephrased versions of the same template scam

### MODULE 7 — Fraud Heatmap
* **Purpose:** Geographic visualization of where cybercrimes are being reported, by fraud type and volume.
* **Filters:**
    * State / district / PIN code
    * Fraud type (UPI fraud, job scam, sextortion, etc.)
    * Time range
    * Amount range
* **Views:**
    * Public heatmap (anonymized, aggregated)
    * Police view (includes report density by station jurisdiction)
    * Journalist view (exportable data for reporting)
* **Implementation notes:**
    * Every complaint must capture location at submission time (district minimum, PIN code preferred)
    * Location is not linked to victim identity in public view
    * Heatmap updates in near real-time as complaints come in

### MODULE 8 — Accountability Engine
* **Purpose:** Create systemic pressure on unresolved complaint clusters. Make ignoring complaints have a cost.
* **Trigger conditions:**
    * 50+ complaints matching same pattern
    * Within 30-day window
    * No resolution / no FIR filed on the cluster
* **On trigger, automatically:**
    1.  Flag the cluster as "Accountability Alert"
    2.  Generate journalist digest (summary, stats, identifiers)
    3.  Generate infographic (shareable, platform-ready)
    4.  Generate one-click RTI template addressed to the relevant authority (state cyber cell / NCRP / MHA)
* **Who sees what:**
    * **Journalists:** Get digest + infographic on their dashboard
    * **Victims in cluster:** Notified their complaint is part of an escalated pattern
    * **Public dashboard:** Cluster appears as an active alert
* **Implementation notes:**
    * RTI template must auto-identify the correct authority based on the geographic spread of the cluster
    * Journalist digest must be accurate — no hallucinated statistics. Only use aggregated data from actual reports
    * Infographic must be exportable as PNG and ready to post

### MODULE 9 — Crime Dashboard
* **Purpose:** Data access layer for police, journalists, and researchers. Different permission levels, same underlying data.
* **Police dashboard:**
    * Clustered scam intelligence by jurisdiction
    * Pre-structured complaint data ready for investigation
    * Emerging pattern alerts
    * Case prioritization by severity and amount
    * Scammer identifier lookup
* **Journalist / researcher dashboard:**
    * Anonymized trend data
    * Regional fraud cluster breakdowns
    * Emerging scam category tracking
    * Story lead generator from pattern data
    * Export data as CSV / JSON for analysis
    * Scam seasonality charts
* **Public dashboard:**
    * Active accountability alerts
    * National and state-level fraud statistics
    * Scam education feed
* **Implementation notes:**
    * Journalists and researchers get access after verification (not open registration)
    * Police get access through a separate onboarding process
    * All exports from journalist dashboard are anonymized — no victim-identifiable information ever exported

### MODULE 10 — Scam Education Layer
* **Purpose:** Teach users how scams are evolving, what to do, and what not to do — passively integrated into the platform.
* **Content types:**
    * How current scams work (updated as new patterns emerge)
    * What to do immediately if targeted
    * What NOT to do (common mistakes that reduce recovery odds)
    * How to alert family members (shareable cards)
* **Delivery:**
    * Shown after complaint submission (cool-down moment)
    * Available as standalone browse section
    * Regional language support for all content
* **Implementation notes:**
    * Education content must be updated as the Scam Similarity Engine detects new patterns — not just static articles
    * Family alert feature: Victim can send a pre-written warning message to contacts via WhatsApp with one tap

### MODULE 11 — Voice Assistant
* **Purpose:** Zero-friction access for victims who cannot type or are too distressed to navigate a UI.
* **Languages supported:** 10 Indian languages (Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Odia, Punjabi)
* **What it handles:**
    * Full complaint intake via voice
    * Urgency classification from spoken description
    * Reads back extracted information for confirmation
    * Guides victim through call co-pilot verbally
* **Implementation notes:**
    * STT must handle distressed speech (fast, interrupted, emotional) — not just clean recorded voice
    * Fallback to text if STT confidence is low
    * Voice session must be saveable as complaint record

### MODULE 12 — WhatsApp Bot
* **Purpose:** Reach victims on the platform they already use. Zero friction — no app download, no registration required to start.
* **Entry flow:**
    * Victim sends message / forwards suspicious screenshot
    * Bot classifies and asks guided questions
    * Generates complaint draft, sends back as document
    * Escalates to app for complex cases (with link)
* **Implementation notes:**
    * Bot must work within WhatsApp's message format limits
    * Screenshot processing via OCR works on forwarded images
    * Bot must handle mid-conversation drop-offs gracefully (victim can resume later)
    * Meta India gateway for WhatsApp Business API

### MODULE 13 — Recovery Workflow Generator
* **Purpose:** After evidence is collected and complaint is drafted, give the victim a clear, personalized action plan.
* **Output:**
    * NCRP complaint summary (ready to submit)
    * Bank dispute email (ready to send)
    * Evidence timeline (chronological, formatted)
    * Escalation path (step-by-step: 1930 → NCRP → bank → cyber cell → consumer forum if needed)
* **All outputs are:**
    * Editable before export
    * Available as PDF download
    * Available as plain text (for WhatsApp / email forwarding)

### MODULE 14 — Investigation Flow
* **Purpose:** Step-by-step redirection that tells the victim exactly where to go next, in what order, and why.
* **Flow adapts based on:**
    * Whether 1930 was called
    * Whether bank was notified
    * Whether NCRP complaint was filed
    * Time elapsed since incident
    * Type of fraud
* **Output:** A numbered checklist that evolves as victim completes steps. Completed steps checked off. Next step always highlighted.

---

## SECTION 3 — USER FLOWS

### FLOW A — Victim, financial fraud, within 60 minutes
1.  Victim opens app / sends WhatsApp message
2.  Describes what happened (voice or text)
3.  Urgency Engine: Financial fraud + < 60 min → **GOLDEN HOUR**
4.  UI switches to Emergency Mode (red, single CTA)
5.  Call 1930 button displayed prominently
6.  Call Co-Pilot activates: What to say, what to ask for
7.  During call: Checklist on screen
8.  After call: Victim enters reference number
9.  Post-call: Next steps generated (bank notification, NCRP complaint, evidence collection prompt)
10. Recovery probability shown honestly

### FLOW B — Victim, financial fraud, after 60 minutes
1.  Victim opens app / sends WhatsApp message
2.  Uploads screenshots / pastes transaction details
3.  Urgency Engine: Financial fraud + ≥ 60 min → **POST-GOLDEN HOUR**
4.  OCR extracts UTR, amount, UPI ID, date from screenshots
5.  NER tags scammer identifiers
6.  Recovery probability shown
7.  NCRP complaint draft generated (editable)
8.  Bank dispute email generated (editable)
9.  Evidence PDF compiled
10. Recovery Workflow Generator shows escalation path
11. Scam Similarity Engine checks: "15 others reported this UPI ID"
12. Scam Education content shown

### FLOW C — Victim, non-financial cybercrime
1.  Victim describes incident (sextortion, harassment, account hack, job scam, etc.)
2.  Urgency Engine classifies type
3.  Routes to Post-Golden Hour Pipeline or Fall-Back Agent
4.  Category-specific guidance shown
5.  Complaint draft generated for relevant authority
6.  Investigation Flow shown: Step-by-step next actions

### FLOW D — Police officer accessing dashboard
1.  Login with verified credentials
2.  Jurisdiction-filtered view of complaints
3.  Clustered intelligence: Which UPI IDs / phones appear most
4.  Accountability alerts: Clusters with no FIR in 30 days
5.  Case export: Pre-structured complaint data for investigation
6.  Pattern lookup: Search by scammer identifier

### FLOW E — Journalist accessing dashboard
1.  Login with verified credentials
2.  Anonymized trend data by state / fraud type / time
3.  Accountability alerts: Triggered clusters with digest
4.  Export data as CSV for analysis
5.  Story lead view: Emerging patterns flagged by system

### FLOW F — Accountability Engine trigger (automated, no user)
1.  HDBSCAN clustering runs continuously on complaint database
2.  Cluster detected: 50+ matching reports, 30-day window
3.  System checks: Any FIR filed on this cluster? **No.**
4.  Auto-trigger fires:
    * a. Cluster flagged as Accountability Alert
    * b. Journalist digest generated (stats, identifiers, map)
    * c. Infographic generated (shareable PNG)
    * d. RTI template generated (correct authority identified)
5.  Journalists see alert on dashboard
6.  Victims in cluster notified: "Your complaint is part of an escalated pattern"
7.  Public dashboard shows cluster as active alert

---

## SECTION 4 — DATA MODEL (CONCEPTUAL)

### Complaint record:
* Complaint ID (generated)
* Timestamp of incident
* Timestamp of report
* Fraud type (classified)
* Amount involved
* Scammer identifiers: UPI ID, phone, account number, handle
* Location: State, district, PIN (no street address)
* Evidence files: Encrypted at rest, linked to complaint
* Status: Pending / escalated / resolved / FIR filed
* Pipeline used: Golden hour / post-golden hour / fall-back
* Cluster membership (if assigned by HDBSCAN)
* Reference number from 1930 call (if applicable)

### Victim record:
* Internal user ID
* Contact for notifications (phone or WhatsApp)
* Language preference
* Complaint IDs linked to this user
* **NO** Aadhaar, **NO** PAN stored
* **NO** financial credentials stored

### Cluster record:
* Cluster ID
* Member complaint IDs
* Common identifiers (shared UPI IDs, phones, etc.)
* Geographic spread
* First report timestamp
* Latest report timestamp
* Total amount across cluster
* Status: Active / accountability triggered / resolved

### Journalist / Police account:
* Account ID
* Role (journalist / police / researcher)
* Jurisdiction (for police: district / state)
* Verification status
* Access log (what data was accessed, when)

---

## SECTION 5 — NON-FUNCTIONAL REQUIREMENTS

* **Accessibility:**
    * Works on 2G connections
    * WhatsApp entry requires no data plan beyond WhatsApp
    * Voice-first for low-literacy users
    * Regional language support throughout (10 languages)
    * Offline mode for PWA: Complaint drafts saveable offline and submitted when connection restores
* **Privacy:**
    * No Aadhaar / PAN stored anywhere
    * No victim identity in public-facing outputs
    * Evidence files encrypted at rest
    * All inference runs on Indian servers (no data leaves India)
    * DPDP Act 2023 compliant
    * Journalists / researchers get anonymized exports only
* **Reliability:**
    * Golden Hour Engine must respond in under 3 seconds
    * OCR must process screenshot within 10 seconds
    * NCRP complaint draft must generate within 15 seconds
    * System must stay functional during high-traffic events (major scam outbreaks = spike in simultaneous reports)
* **Honesty:**
    * Recovery probability always shown as range, never inflated
    * Scam similarity counts are exact — no rounding up
    * No false assurances about fund blocking

---

## SECTION 6 — BUILD SEQUENCE (PRIORITY ORDER)

### Phase 1 — Core victim flow
1.  Urgency Engine (classifier + router)
2.  Golden Hour Engine + Call Co-Pilot
3.  OCR intake (screenshot → UTR / amount / UPI ID)
4.  NCRP complaint auto-draft
5.  Bank dispute email auto-draft

### Phase 2 — Intelligence layer
6.  Scam Similarity Engine (matching across complaints DB)
7.  Fraud Heatmap (geographic visualization)
8.  Cluster detection (HDBSCAN on complaints)
9.  Recovery Workflow Generator (full action plan)
10. Investigation Flow (step-by-step checklist)

### Phase 3 — Accountability + access
11. Accountability Engine (trigger + digest + RTI)
12. Police dashboard
13. Journalist / researcher dashboard
14. Public dashboard

### Phase 4 — Reach and education
15. WhatsApp Bot
16. Voice Assistant (10 languages)
17. Scam Education Layer
18. Fall-Back AI Agent (edge case handling)

---

## SECTION 7 — MVP SCOPE (WHAT TO DEMO AT HACK4SOC)

### The following must be live and demonstrable:
* Voice / text / WhatsApp intake → fraud classification + urgency
* Golden Hour Engine: Emergency Mode UI + Call Co-Pilot
* Evidence OCR: UPI receipt / bank SMS → UTR + amount extraction
* NCRP complaint auto-draft + bank dispute email
* Fraud heatmap with 500 seeded reports, live HDBSCAN
* Scam Similarity Engine: "N reports match this UPI ID"
* Accountability Engine: Trigger → flag + infographic + RTI
* Fall-Back Agent: 3 edge case scenarios working live
* Journalist digest + infographic (triggered during demo)

### Out of MVP scope (post-hackathon):
* Full 10-language voice assistant
* Police dashboard with real jurisdiction data
* Live WhatsApp bot (can demo on test number)
* Scam Education Layer (can show static version)

---
**Team AETOS — Akshay Kumar, Nandan Kumar C, Vishruth M R**
*HACK4SOC 3.0 · Governance PS1 · CyberSaathi*
