---
name: fastapi-mock-adapters
description: Use for CyberSaathi backend work involving FastAPI, Pydantic models, seed data, mock integrations, deterministic OCR/NER/recovery/similarity adapters, PostGIS-ready schemas, and API boundaries.
---

# FastAPI Mock Adapters

Use this skill when building backend or shared API behavior for CyberSaathi.

## Architecture

- FastAPI service with clear routers, services, models, seed fixtures, and
  adapters.
- Pydantic models mirror the conceptual records in `AGENTS.md`.
- PostgreSQL + PostGIS is the production-shaped target.
- For MVP, in-memory or file-backed seed data is acceptable if the persistence
  boundary is easy to replace.

## Adapter rule

All external systems are simulated in V1:

- 1930 helpline.
- NCRP.
- Bank dispute.
- RTI.
- WhatsApp.
- Journalist digest.

Each adapter must expose:

- request model
- response model
- deterministic success/failure state
- mock event log entry
- no real network call to the official service

## ML mock rule

Use deterministic service interfaces for:

- urgency classification
- OCR extraction
- NER/entity extraction
- redaction
- recovery probability band
- similarity matching
- cluster trigger detection
- Fall-Back Agent scripted flow

The interface should make later real-model replacement straightforward, but the
MVP must work without model downloads or external inference.

## Privacy and redaction

- Redact Aadhaar, PAN, OTPs, passwords, PINs, full card numbers, and bank
  credentials before persistence.
- Public APIs return aggregate/anonymized data only.
- Keep raw evidence out of public, journalist, and researcher responses.

## API shape

Prefer resource-oriented routes:

- `POST /intake/classify`
- `POST /evidence/extract`
- `POST /complaints`
- `POST /complaints/{id}/documents`
- `GET /complaints/{id}`
- `GET /similarity`
- `GET /clusters`
- `POST /clusters/{id}/trigger-accountability`
- `GET /dashboards/public`
- `GET /dashboards/journalist`
- `GET /dashboards/police`

Names may change, but keep boundaries clear and testable.

## Verification

Add focused tests for routing rules, redaction, generated documents, similarity
counts, accountability thresholds, and adapter event logs.

## Pitfall: empty `500 Internal Server Error` with no traceback

If a route returns `500` with body `Internal Server Error` (no JSON, no
traceback in the uvicorn log), FastAPI's default error handling swallowed the
real exception. The cause is almost always a Pydantic response-model
serialization failure — uvicorn logs the ASGI framework trace but not the
underlying `ResponseValidationError`. Symptoms:

- The same handler called directly from Python returns a valid object.
- curl gets `Content-Type: text/plain; charset=utf-8` and a 21-byte body.
- uvicorn log only shows the Starlette routing/middleware frames.

Fix path (do these in order):

1. `curl -i` to confirm `content-type: text/plain` (not `application/json`).
   JSON-bodied 500s are real exceptions; plain-text 500s are serialization.
2. Reproduce in-process: `uv run python -c "from app.routers.<r> import <fn>; ..."` —
   if it works in-process, it's serialization.
3. Suspect fields, in this order:
   - `tuple[int, int]` (e.g. recovery `range_pct`) — FastAPI/Pydantic v2 does
     serialize tuples, but some custom encoders choke. Switch to a
     `conlist(int, min_length=2, max_length=2)` or a nested model.
   - Enums that aren't str-valued — add `model_config = ConfigDict(use_enum_values=True)`
     or serialize via `str(enum.value)` at the boundary.
   - Datetimes with `default_factory=datetime.utcnow` — Pydantic serializes
     fine, but make sure no `field: SomeClass` slipped in without a type hint.
4. Easiest patch: wrap the route body in `try/except` and `raise HTTPException(500, repr(e))`
   so the real error lands in the uvicorn log. Fix the underlying type, then
   remove the wrapper.
5. Or, more directly: `uv run uvicorn app.main:app --log-level debug` — debug
   logs include Starlette's response-validation stack frame.

For ad-hoc probing, the script `scripts/probe_endpoint.sh` runs a request
against a known good route and another against a suspect route so you can
compare response shapes. Make it executable: `chmod +x scripts/probe_endpoint.sh`.
