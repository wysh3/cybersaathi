---
name: postgres-persistence
description: Use for CyberSaathi database work involving PostgreSQL, SQLAlchemy, Alembic migrations, seed loading, Postgres-first runtime verification, DB health checks, and avoiding false claims that data is persisted when the app is running in explicit in-memory fallback mode.
---

# CyberSaathi Postgres Persistence

Use this skill before changing or verifying the CyberSaathi persistence layer.

## Required First Checks

1. Read `AGENTS.md` and `team/STATUS.md`.
2. Check whether Postgres is actually running:

```bash
pg_isready -h 127.0.0.1 -p 5432
ss -ltnp | rg ':5432'
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}'
```

3. Check whether the API is actually using DB mode:

```bash
env | rg '^DATABASE'
curl -s http://127.0.0.1:8000/healthz
```

If `DATABASE_ENABLED=false` is set or `/healthz` does not include `database`,
the app is running in explicit in-memory fallback mode. Say that plainly.

## CyberSaathi DB Truth

- Default runtime mode is PostgreSQL.
- In-memory seed mode is an explicit fallback with `DATABASE_ENABLED=false`.
- Default DB URL:

```text
postgresql+asyncpg://cybersaathi:cybersaathi@127.0.0.1:5432/cybersaathi
```

- Sync SQLAlchemy uses the psycopg driver derived from `DATABASE_URL`.
- Never claim production persistence unless a Postgres-backed API boot, seed
  load, and create/read smoke test have passed.

## Migration Rules

- Use Alembic for schema changes.
- Keep Pydantic models, ORM models, and migrations aligned.
- Do not add raw SQL migrations unless SQLAlchemy/Alembic cannot express the
  change clearly.
- Do not store Aadhaar, PAN, OTP, PIN, passwords, full card numbers, or raw
  screenshots.

## Verification

For DB work, run at least:

```bash
cd apps/api
PYTHONPATH=.:../.. uv run pytest
PYTHONPATH=.:../.. uv run python -m app.seed.seed_postgres
```

If no local Postgres is running, report Postgres verification as blocked and
keep any `DATABASE_ENABLED=false` test result separate.

## Handoff Language

Use precise status:

- `In-memory verified`: tests passed without DB mode.
- `Schema verified`: migrations import/apply.
- `Seed verified`: seed script loaded 500+ complaints into Postgres.
- `Persistence verified`: API can create/read sessions, complaints, evidence,
  generated documents, and mock integration events with PostgreSQL runtime.

Do not collapse these into one vague "DB done" statement.
