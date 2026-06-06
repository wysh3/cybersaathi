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

### "Remove X" means delete, not rename

When the user says "remove X string from the UI," literally delete that text
or component — do not swap it for different copy (e.g. "Accountability engine"
→ do NOT rename to "Guidance"; delete the eyebrow, alert title, etc.). The
user wants the concept gone, not retitled. This applies to:
- eyebrow labels on PageHeader
- badge labels on StatusBadge
- AlertTitle text
- sidebar cards and footer text
- page metadata titles (use the section name or fallback to app name)

Pitfall: replacing "Complaint package" with "Case file" or "Documents" is a
rename, not a delete. If the user asks to remove a string, remove the JSX
prop or element entirely unless removing it would break a required prop — in
that case use the shortest functional alternative (section name, not a
replacement concept).

### Sidebar: sticky, collapsible, no-drama animation

The sidebar uses `sticky top-0 h-dvh overflow-hidden` — it sticks to the
viewport top, fills the full height, and never scrolls internally. The main
content scrolls independently beside it.

Collapsible with a toggle button at the bottom (chevrons `<<` / `>>`):
- **Expanded:** 260px wide, shows logo + tagline, nav labels, footer card
  with Call 1930 button.
- **Collapsed:** 72px wide, shows only nav icons centered, no text labels,
  footer card hidden.
- **Animation:** `transition-all duration-300
  ease-[cubic-bezier(0.16,1,0.3,1)]` — smooth deceleration, **no
  overshoot/bounce**. The user explicitly rejects bouncy spring animations as
  "too much drama." Keep it clean and professional.

Pitfalls:
- Do NOT use `framer-motion` or `motion/react` for sidebar collapse — pure
  CSS `transition` with the above easing is sufficient and lighter.
- The outer flex layout in AppShell naturally adjusts content width when the
  sidebar width changes; no manual margin calculations needed.
- **Nav link text labels MUST use `hidden` (display: none) when collapsed,
  NOT `pointer-events-none opacity-0`.** Using opacity-0 keeps the text in the
  flex layout, so `gap-4` continues to push the icon off-center — the user
  reported icons "going out of the window." Use `hidden` with conditional
  rendering: `collapsed ? "justify-center px-0" : "gap-4 px-4"`. The width
  transition on the sidebar provides the smooth visual; labels snap in/out
  cleanly.

## Full-bleed layout

CyberSaathi uses a **full-bleed layout** with no glass container wrapping
everything:

```
<div className="flex min-h-dvh w-full">
  <DesktopSidebar />
  <main
    id="main"
    data-print="root"
    className="flex min-w-0 flex-1 flex-col px-4 pb-28 pt-5 ..."
  >
    {children}
  </main>
</div>
```

Rules:
- Sidebar goes edge-to-edge on the left. No outer `max-w-[1680px]` centering
  wrapper. No glass rectangle (`md:rounded-[34px] md:border md:border-white/70
  ...`) around the sidebar + content.
- Content sits directly on the `app-background`.
- **No top header bar.** The header with Emergency SOS button is removed
  entirely — it was leftover from the glass-container era and the Emergency
  SOS button is redundant with the "Call 1930" button already in the sidebar.
  When removing a container/layout structure, check if any child components
  became orphaned or redundant and remove those too.
- Mobile: MobileTopBar (sticky header with title + 1930 button) and
  MobileBottomNav (5-tab bottom nav) exist alongside the full-bleed desktop
  layout.

## Visual identity (civic government — no AI slop)

CyberSaathi has a specific visual identity shaped by repeated user corrections.

### Border radius: moderate, not extreme

Previous values (too round): sm=12, md=18, lg=26, xl=34
Values I used (too sharp): sm=4, md=6, lg=8, xl=12
**Correct moderate values: sm=6, md=10, lg=14, xl=18**

For Tailwind v4 `rounded-*` classes (which have their own fixed values, not
CSS variables):
- Cards/sections/panels → `rounded-xl` (16px)
- Sidebar items → `rounded-[10px]`
- The GlassPanel component → `rounded-xl` (16px)
- Buttons/intake method cards → `rounded-xl` (16px)

Do NOT use `rounded-3xl` (32px) or `rounded-[32px]` anywhere. Do NOT use
`rounded-md` (8px) for cards/panels — that's too sharp. The user will call
you out if you over-correct in either direction.

Pitfall: when doing bulk radius reduction, CSS variables (`--radius-*`) only
affect shadcn components. Tailwind utility classes like `rounded-2xl`,
`rounded-3xl` have their own fixed values in Tailwind v4 and must be replaced
individually. Use execute_code with patch + replace_all to do bulk
replacement across files.

### Font consistency: one sans font, no serif mixing (hero exception)

- Use **one sans font** throughout: IBM Plex Sans (via `--font-plex-sans`).
- Remove the `font-serif-display` utility or make it use `var(--font-sans)`.
- Do not mix serif for headings/titles with sans for body. Headlines, card
  titles, eyebrow labels, nav items — all the same sans font.
- IBM Plex Mono is acceptable for data/code display (`tabular-nums`, code
  snippets, badge counts).
- **Exception — hero/intake heading:** The \"One Portal. Every Cyber Emergency.\"
  heading in `ChatIntakeComposer` uses `font-serif` (Newsreader). This is
  intentional — the user prefers the serif typographic presence for this
  single hero headline. Do NOT change it to sans. Do NOT remove the class.
  Adding `font-sans` will visibly break it.
- **Pitfall:** for other headings, do NOT use `font-sans` — Tailwind's
  `font-sans` maps to a generic stack, not the project's IBM Plex Sans. Just
  remove the explicit font class entirely (let the element inherit) or use
  `font-[family-name:var(--font-plex-sans)]`.
- Verify no component uses `font-serif-display` with a serif font family
  (except the hero heading).

### Background palette: cool serene blue-gray

The background must be a **cool, serene misty blue-gray** — not warm beige,
not bright sky blue:

- Base: `#edf2f7` → `#fafbfc` → `#e8eef5` (linear gradient)
- Overlay: soft translucent blue-gray radial gradients
- The `AppBackground` component's fixed overlay uses similar cool tones:
  `rgba(210, 225, 242, 0.3)` and `rgba(242, 246, 252, 0.65)` radial
  gradients on a `#f0f4f9` → `#fafcfe` → `#ecf1f7` linear gradient.

The user's first attempt (warm cream/beige) was rejected because it clashed
with the blue UI accents (sky-500, sky-700, blue sidebar backgrounds). Cool
serene complements the blue civic palette.

Also update the `::before` and `::after` pseudo-elements in
`.app-background` to match — don't leave blue sky tones behind when
switching to cool serene.

### UI accent colors: serene light blue only

The user explicitly rejects dark/bright blues in the chat UI. `sky-600` and
`sky-700` are banned everywhere — too saturated for the calm civic aesthetic.
Interactive elements (buttons, CTAs) use `sky-500` as the maximum; decorative
elements (bubbles, avatars, badges, rings) cap at `sky-400`. `sky-300` is the
default background for user bubbles and progress bars.

| Element | Use (max) | Never use |
|---------|-----------|-----------|
| User message bubbles | `sky-300` bg + `sky-950` text | `sky-600` bg + `white` text |
| Assistant avatars / shields | `sky-400` icon on `sky-50` bg | `sky-700` on `sky-100` |
| Evidence borders | `sky-100` | `sky-200` |
| Evidence badge text | `sky-400` | `sky-600` |
| Focus rings | `sky-200/50` | `sky-300/50` |
| Progress bars (active) | `sky-300` | `sky-600` |
| Send button | `sky-500` bg, `sky-600` hover + `text-white` | green (`#2d4c3f`) or sky-300 (too pale) |
| Confirm CTA button | `sky-500` bg + `text-white` | sky-300 (too pale, low contrast) |
| Scenario chip hover | `sky-200` | `sky-300` |

The cap is `sky-400` for icons and `sky-300` for decorative backgrounds.
Buttons and CTAs use `sky-500` bg / `sky-600` hover with `text-white`. The
green send button (`#2d4c3f` / `#1d3229`) is banned — use blue instead.

### AppBackground: single-layer image overlay

The `AppBackground.tsx` component should be a **single, clean layer** — no
duplicate gradient stacking. The body's `.app-background` CSS class from
`globals.css` provides the base gradient. AppBackground just adds a subtle
image texture:

```tsx
export function AppBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/bg.png')",
          opacity: 0.3,
        }}
      />
    </div>
  );
}
```

Do NOT stack another gradient on top of the image — the user reported that as
"double shit white background." One texture layer at low opacity on top of
the body's CSS gradient is enough.

### Site logo: use /logo.png everywhere

The project has a `icon.png` at the project root that serves as the brand
mark. Copy it to `public/logo.png` and reference it as `/logo.png` via
Next.js `<Image>` component in:
- `DesktopSidebar.tsx` — 44x44
- `MobileTopBar.tsx` — 28x28
- Replace the old `Logo` component (SVG shield) — it's no longer used.

Also set up `app/icon.svg` (64x64 shield+checkmark in #1f7eea blue) for the
browser tab favicon. Keep `public/icon.svg` and `app/icon.svg` in sync.

### Orphaned UI removal

When you remove a parent container or layout structure (e.g. the glass
container rectangle in AppShell), **check every child component for orphan
status**. Common orphans:
- The desktop header bar (Emergency SOS button) — redundant once the sidebar
  has "Call 1930"
- StatusBadge labels that referenced the removed container's visual context
- PageHeader eyebrow labels that no longer have a visual frame
- Footer cards with copy that only made sense inside the old container

If a child is now redundant, remove the entire child element, not just its
text. "Remove X" means delete the JSX node, not change its text content.

### Map/heatmap error handling

The map endpoints return district-level data for clicked states. Important
pitfalls discovered in production:

- **API should return empty data, not 404**, for states with zero complaints
  in the seed data. The frontend expects a valid response shape
  (`{districts: {}, fraud_types: {}, ...}`), not an HTTP error.
- **Frontend per-state error isolation:** a district fetch failure for one
  state must NOT call `setError()` at the component top level — that kills
  the entire map. Instead, catch the error and set `setDistrictData(null)`,
  which simply doesn't render the district panel.
- **No double-encoding:** if `api.ts` already calls `encodeURIComponent` on
  the state name parameter, the calling component must NOT pre-encode. Pass
  the raw state name.

### General UI correction pattern

When the user says something like "fix the radius" or "change the
background," they often mean "tweak it, don't rethink it." Avoid
over-correcting:
- If the original is too round, don't make it square.
- If the original is too warm, don't go ice-cold.
- Make moderate, incremental adjustments and verify visually.
- If you're unsure about the amount, ask before committing to all files.

**Document page layout and DataPanel overflow rules:** see
`references/document-page-and-datapanel-rules.md`.

### Chat intake: progressive hero → minimal chat

The landing page chat follows a progressive reveal pattern with a typing
animation. **For backend LLM pipeline architecture, pitfalls, and testing
checklist, see `references/llm-intake-backend-pitfalls.md`.**
**For WhatsApp transport layer (Baileys gateway for demos, official API for
production), see `references/whatsapp-gateway.md`.**

**Hero state** (before first message):
- Headline "One Portal. Every Cyber Emergency." types out character by
  character (40ms interval via `useEffect` + `setTimeout` + `typedChars`
  state counter).
- Tagline, pill input, and scenario chips fade+slide in *sequentially after*
  typing completes (`typingDone` state).
- The pill input has a **Plus (+)** button on the left for image upload, and a
  send button (`bg-sky-500`, `sky-600` hover) on the right. The Plus button
  triggers a hidden `<input type="file" accept="image/*">`. When an image is
  selected, the Plus icon becomes a circular thumbnail preview.
- **Hero container is NOT wrapped in `anim-fade-in-slow`** — that class has
  460ms of `opacity: 0` with `animation-fill-mode: both`, which makes the
  content area invisible for nearly half a second, creating the perception of
  a blank page / "background popping in." The typing animation itself is the
  entrance; no wrapper fade is needed.

**Chat state** (after first message sent):
- Everything in hero state is GONE — no header, no tagline, no scenarios.
- Clean messages in a scrollable flex-1 area with `pb-28` (leaves room for the
  fixed input bar).
- **Fixed** pill input at bottom: `fixed inset-x-0 bottom-0 z-20` with gradient
  fade (`bg-gradient-to-t from-[#fafbfc] via-[#fafbfc]/85 to-transparent pb-5
  pt-8 md:pb-6`). The pill itself is centered with `max-w-3xl mx-auto px-4`.
  **Do NOT use `sticky bottom-0`** — sticky positioning inside a `flex-col`
  container with `min-h-dvh` causes the bar to render too high or at the wrong
  position. `fixed inset-x-0` is reliable. The bar spans full viewport width but
  the centered pill and gradient look natural.
- No GlassPanel, no method cards, no evidence panel, no sidebar, no
  PrivacyNotice, no routing info in the chat view.

**sendMessage onClick gotcha:**
The `sendMessage` function has optional params. **Must wrap in arrow
function**: `onClick={() => sendMessage()}`, never `onClick={sendMessage}`
(React passes the event as first arg, which gets treated as `customText`,
causing a TS type error).

**Auto-scroll pattern — no jumping:**
The old `scrollIntoView({ behavior: "smooth" })` on every chatMessages change
causes a jarring visual jump when messages arrive. The fix tracks message count
and only scrolls when a new message is actually added, using `behavior: "instant"`:

```tsx
const prevMsgCount = useRef(0);

useEffect(() => {
  const count = chatMessages.length;
  if (count > prevMsgCount.current) {
    prevMsgCount.current = count;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    });
  }
}, [chatMessages]);
```

Key points: (1) `requestAnimationFrame` ensures DOM painted before scroll,
(2) `behavior: "instant"` avoids animation bounce, (3) count tracking prevents
scroll on unrelated re-renders.

**Typing animation pattern:**
```tsx
const FULL_TITLE = "One Portal. Every Cyber Emergency.";
const [typedChars, setTypedChars] = useState(0);
const [typingDone, setTypingDone] = useState(false);

useEffect(() => {
  if (chatStarted) return;
  if (typedChars < FULL_TITLE.length) {
    const t = setTimeout(() => setTypedChars((c) => c + 1), 40);
    return () => clearTimeout(t);
  }
  setTypingDone(true);
}, [typedChars, chatStarted]);

**Variable speed & no cursor:**
- Start from `useState(0)` (no preloaded chunk). First 12 chars fire at 18ms,
  then letters at 32ms, spaces/periods at 110ms.
- **No blinking cursor** — the user removed it. The letter reveal alone serves
  as the entrance. Letters use `blur-[3px] -> blur-none` + `translate-y-[2px]`
  -> `translate-y-0` + opacity for a smooth focus effect.

Sequential reveal uses `cn()`:
Sequential reveal uses `cn()`:
`typingDone ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"`

**Chat bubble spacing:** ChatBubble component needs `mb-3` on the outer div.
Without it, successive messages (especially assistant + user back-to-back)
touch each other with zero gap.

**Messages grow from bottom — spacer pattern:**
Chat messages must stack from the bottom of the scrollable area, right above
the input bar. Without this, messages float at the top with empty space below.
Insert a spacer div with `flex-1` before the messages:

```tsx
<div className="flex flex-1 flex-col overflow-y-auto px-4 pb-28 pt-6 md:px-8">
  <div className="flex-1" />  {/* spacer — collapses to 0 when overflow */}
  {chatMessages.map(...)}
  ...
</div>
```

The spacer fills all available space when messages don't overflow. Once content
exceeds the viewport, the spacer collapses to 0 and scrollbars appear naturally.

**Inline confirm button:** When `canConfirm` is true (facts ready), show a
confirm button directly in the chat flow — not hidden in a sidebar card:

```tsx
{canConfirm && !submitting && (
  <div className="flex justify-start gap-3 mt-1">
    <span className="...avatar..."><Shield /></span>
    <button onClick={confirmFacts} disabled={confirming}
      className="rounded-xl rounded-bl-md bg-sky-500 px-6 py-3 text-white shadow-glass-soft ...">
      {confirming ? <Loader2 /> : <CheckCircle2 />}
      {confirming ? "Creating case…" : "Confirm — this looks right"}
    </button>
  </div>
)}
```

This appears after the last assistant message, styled as a chat bubble with\nthe shield avatar. Clicking it calls `confirmFacts()` which creates the\ncomplaint and navigates to the next step.

**Image upload — Plus button in input bar:**

Both the hero pill and chat floating input have a Plus (+) button on the left
that triggers image upload:

```tsx
// State
const [imageFile, setImageFile] = useState<File | null>(null);
const [imagePreview, setImagePreview] = useState<string | null>(null);
const fileInputRef = useRef<HTMLInputElement>(null);

// Handler
function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  setImageFile(file);
  setImagePreview(URL.createObjectURL(file));
}
```

The Plus button renders a thumbnail preview when an image is selected:
```tsx
<button onClick={() => fileInputRef.current?.click()} ...>
  {imagePreview ? (
    <img src={imagePreview} className="size-5 rounded-full object-cover" />
  ) : (
    <Plus className="size-4" />
  )}
</button>
```

A hidden file input is placed outside the chat view:
```tsx
<input ref={fileInputRef} type="file" accept="image/*"
  onChange={handleImageSelect} className="hidden" />
```

The vision model `nvidia/nemotron-nano-12b-v2-vl` is configured in the backend
provider (`LLM_MODEL_VISION` env var or default in `provider.py`).
