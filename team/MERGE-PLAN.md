# CyberSaathi Merge Plan

This file is for Vishruth-as-maintainer. Builders should use `team/STATUS.md`.

## Current Branch State

- `main`: `86d5b6f chore: stabilize main and sync team roadmap`
- Active branch: `feat/vishruth/F005-premium-app-redesign-system`
- F005 is large: Next 16 upgrade, app shell redesign, docs, screenshots,
  design pack assets, emergency/documents component decomposition.

## Merge Strategy

### Preferred Path

1. Finish F005 review.
2. If cleanup is small, do F013 directly on top of F005.
3. Verify full app.
4. Merge F005/F013 into `main` as one reviewed redesign foundation.
5. Tell Akshay to start F007 from updated `main`.
6. Tell Nandan to rebase F006 if his README/team docs conflict.

### Alternate Path

Use only if F013 cleanup grows too large:

1. Merge F005 as foundation.
2. Immediately create `feat/vishruth/F013-design-parity-cleanup` from updated
   `main`.
3. Do only cleanup tasks there: mobile nav overlap, transaction disclosure,
   screenshots, `jsx`, dev hydration scoping.

## F005 Merge Gate

Run:

```bash
cd apps/api && PYTHONPATH=.:../.. uv run pytest
cd ../web && npm run typecheck && npm run lint && npm run build
npx tsx tests/browser-smoke.ts
npx tsx tests/e2e-priya.ts
npx tsx tests/e2e-fall-back.ts
npx tsx tests/e2e-golden-hour-bilingual.ts
npx tsx tests/e2e-refresh.ts
```

Also verify:

- `git diff --check` is clean.
- `team/STATUS.md` records the merge decision.
- Screenshots are current enough to review the app.
- No public dashboard screenshot exposes victim PII.
- No generated copy promises recovery.

## Known Merge Risks

- Screenshot churn is heavy.
- `screenshots/v4` and `screenshots/v5` both exist.
- `apps/web/tsconfig.json` changed `jsx` to `react-jsx`.
- `apps/web/.next-docs` exists even though Next 16 now has
  `node_modules/next/dist/docs`.
- `apps/web/.agents/skills/shadcn/` duplicates the root shadcn skill.
- `apps/web/.eslintrc.json` may be stale now that ESLint flat config is active.
- `scripts/screenshot-v4.cjs` and `apps/web/scripts/police-drilldown-shot.cjs`
  still point at old screenshot conventions.

Do not ignore these. Either fix them in F013 or explicitly record why they are
safe to leave.

## Post-Merge Branch Instructions

For Nandan:

```bash
git checkout main
git pull origin main
git checkout -b feat/nandan/F006-local-postgres-activation
```

For Akshay, only after F005/F013 shell lands:

```bash
git checkout main
git pull origin main
git checkout -b feat/akshay/F007-golden-hour-design-pack-journey
```

For Vishruth cleanup branch, if not done on F005:

```bash
git checkout main
git pull origin main
git checkout -b feat/vishruth/F013-design-parity-cleanup
```
