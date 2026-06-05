---
name: nextjs-ai-agent-coding
description: Use for any Next.js App Router implementation, refactor, debugging, PWA, routing, forms, metadata, caching, server/client component, or frontend architecture task. Forces AI coding agents to read version-matched bundled Next.js docs before editing.
---

# Next.js AI Agent Coding

Use this skill whenever touching Next.js code in CyberSaathi.

## Source of truth

Before writing or changing Next.js code:

1. Check whether `node_modules/next/dist/docs/` exists.
2. Read the relevant installed docs from that directory before coding.
3. If the docs are missing on an older Next.js version, run
   `npx @next/codemod@latest agents-md` after the app is initialized and read
   the generated `.next-docs/` files.
4. Treat the installed docs as more authoritative than model memory.

Recommended doc targets:

- Routing and layouts: `01-app/01-getting-started/`.
- App Router guides: `01-app/02-guides/`.
- API references and file conventions: `01-app/03-api-reference/`.
- PWA, forms, testing, metadata, images, fonts, caching, and route handlers:
  search under `node_modules/next/dist/docs/`.

## CyberSaathi Next.js conventions

- Use App Router and TypeScript.
- Keep the first screen as the emergency intake product, not a landing page.
- Prefer Server Components for static shells and data display.
- Use Client Components only for timers, forms, upload mocks, local workflow
  state, dashboards, and interactive controls.
- Keep client components as leaf-level as practical.
- Use `next/font` or self-hosted fonts; do not add production Google Fonts
  `<link>` tags.
- Use `next/image` only when image optimization is useful. For generated
  infographic previews, canvas/SVG/HTML export may be more appropriate.
- Use route handlers only for app-local mock endpoints. Do not call real
  government, bank, WhatsApp, NCRP, 1930, or RTI services.
- Make PWA behavior useful for draft preservation and low-connectivity states.

## UI implementation guardrails

- Follow `AGENTS.md` and the local taste-skill direction before inventing UI.
- Avoid marketing-page sections unless explicitly requested.
- Do not use AI-purple gradients, decorative blobs, dark-tech panels, or
  generic chatbot framing.
- Emergency Mode is the only place where red dominates.
- Every form field has a visible label, useful helper/error copy, and keyboard
  accessibility.
- Every mobile flow must keep the current action visible and tappable.

## Verification

After Next.js changes, run only commands that exist in `package.json`:

- lint
- typecheck
- test
- build

For visual work, run Playwright or browser screenshots when available and check
desktop plus mobile viewports.
