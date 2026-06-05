---
name: verification-and-qa
description: Use before finalizing CyberSaathi coding work, especially frontend flows, emergency UX, privacy-sensitive extraction, generated documents, dashboards, accessibility, Playwright screenshots, lint/typecheck/test/build, and acceptance criteria validation.
---

# Verification and QA

Use this skill before handing off implementation work.

## Command discipline

- Inspect `package.json`, `pyproject.toml`, or equivalent before running
  checks.
- Run only commands that exist.
- Prefer targeted tests first, then broader checks.
- Do not run formatters that rewrite files unless explicitly intended.

## Minimum verification areas

For frontend:

- lint
- typecheck
- unit tests if present
- production build if feasible
- Playwright/screenshot checks for desktop and mobile when UI changed

For backend:

- unit tests for services/adapters
- API schema validation
- redaction tests
- seed-data determinism tests

## Product acceptance checks

Verify the MVP against `AGENTS.md`:

- User can start from "What happened?" without registration.
- Priya scenario routes to Golden Hour.
- Emergency CTA, countdown, script, extracted facts, and reference capture are
  visible.
- Post-Golden-Hour flow generates editable complaint documents.
- Recovery probability is a range and never a guarantee.
- Similarity and cluster counts come from seed data.
- Accountability trigger produces alert, digest, RTI, and infographic copy.
- Public dashboards are anonymized and aggregate-only.
- Fall-Back scenarios work.
- Sensitive values are redacted.
- No real official APIs are called.

## Accessibility and stress checks

- Keyboard navigation works for the active flow.
- Form fields have visible labels and errors.
- CTA contrast passes WCAG AA.
- Text does not overflow on mobile.
- Emergency Mode shows one obvious next action.
- Loading, empty, error, offline, low-confidence, and completed states exist.

## Final response

Report what changed, what passed, and anything not run. Keep it concise and
specific.
