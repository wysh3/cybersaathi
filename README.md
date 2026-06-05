# CyberSaathi

CyberSaathi is a cybercrime-first AI Emergency Government Navigator for
Hack4SOC 3.0, Governance PS1. Team AETOS: Akshay Kumar, Nandan Kumar C,
Vishruth M R.

The app turns a victim's first description into the next correct action:
Golden Hour 1930 guidance, post-golden-hour complaint packages, seeded scam
similarity, India heatmap intelligence, and accountability escalation. All
official integrations are simulated for the hackathon alpha.

## Current State

- Frontend: Next.js 16 App Router, TypeScript, Tailwind CSS v4, shadcn/ui
  `radix-nova`, lucide icons.
- Backend: FastAPI with deterministic routing, extraction, redaction,
  recovery, similarity, cluster, document, and mock integration services.
- Data: versioned seed fixtures, vendored local India map data, and
  Postgres-first persistence.
- UI: desktop app sidebar, mobile top bar + bottom nav, real India heatmap,
  judge demo route, citizen emergency flows.
- Team workflow: see `team/STATUS.md` and the local
  `cybersaathi-team-workflow` skill.
- Merge sequencing: see `team/MERGE-PLAN.md`.

## Run Locally

```bash
# Install Python workspace dependencies
uv sync

# API on 127.0.0.1:8000, Postgres-first runtime
docker compose up -d postgres
cd apps/api
PYTHONPATH=.:../.. uv run python run_api.py

# Web on 127.0.0.1:3000
cd ../web
npm install
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npm run build
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npm run start
```

Open <http://127.0.0.1:3000>.

Use `npm run dev` only for editing. On the current Next.js 16 branch, final
browser verification and demos should run against `npm run build` +
`npm run start`; the dev server can produce HMR WebSocket noise and unreliable
hydration in this local environment.

## PostgreSQL Runtime

Postgres is the normal local/runtime database. The API defaults to PostgreSQL;
use `DATABASE_ENABLED=false` only for explicit in-memory fallback tests.

Check whether Postgres is actually running:

```bash
pg_isready -h 127.0.0.1 -p 5432
ss -ltnp | rg ':5432'
docker ps
```

Start local PostGIS/Postgres:

```bash
docker compose up -d postgres
```

Seed and run API:

```bash
cd apps/api
DATABASE_URL=postgresql+asyncpg://cybersaathi:cybersaathi@127.0.0.1:5432/cybersaathi \
PYTHONPATH=.:../.. \
uv run python -m app.seed.seed_postgres

DATABASE_URL=postgresql+asyncpg://cybersaathi:cybersaathi@127.0.0.1:5432/cybersaathi \
PYTHONPATH=.:../.. \
uv run python run_api.py
```

`/healthz` must include `"database":"connected"` in normal runtime. If it does
not, stop and fix Postgres before claiming the app is stable.

## Verification

```bash
# Backend
cd apps/api
PYTHONPATH=.:../.. uv run pytest

# Frontend
cd apps/web
npm run typecheck
npm run lint
npm run build

# Browser / E2E
npx tsx tests/browser-smoke.ts
npx tsx tests/e2e-priya.ts
npx tsx tests/e2e-fall-back.ts
npx tsx tests/e2e-golden-hour-bilingual.ts
npx tsx tests/e2e-refresh.ts
```

Baseline alpha status:

- Backend pytest: 37 tests passing.
- Frontend build: 13 static routes on Next.js 16.
- Browser smoke and Priya/fall-back/bilingual/refresh E2E flows passing
  against production preview.

Known non-blocking warnings:

- FastAPI/Starlette test client warns about `httpx` deprecation.
- `next dev` is not the verification path for this branch; use production
  preview for browser checks.

## Repo Layout

```text
apps/api/      FastAPI backend
apps/web/      Next.js alpha app
packages/      Shared Python package
seed_data/     Versioned demo fixtures
screenshots/   Browser, flow, and design-review screenshots
team/          Minimal team tracking
.agents/skills/Local coding-agent skills
```

## Safety Rules

- No real calls to 1930, NCRP, banks, WhatsApp, RTI, police, or government
  systems in the alpha.
- Never promise fund recovery.
- Do not store or display Aadhaar, PAN, OTPs, PINs, full card numbers,
  passwords, or bank credentials.
- Public, police, journalist, and dashboard surfaces must remain anonymized
  and aggregate-only.
