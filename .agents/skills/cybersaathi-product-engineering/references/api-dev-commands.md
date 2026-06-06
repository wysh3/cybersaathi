# API Server: Development Commands

## Start the server

```bash
cd apps/api
PYTHONPATH=apps/api:../../packages:.. uv run fastapi dev --port 8000
```

The three `PYTHONPATH` entries:
- `apps/api` — the api app itself
- `../../packages` — the `cybersaathi-shared` workspace package (contains `shared.constants`)
- `..` — project root for any root-level modules

**PITFALL:** `PYTHONPATH=apps/api:..` is wrong — `..` alone doesn't cover `packages/shared/`. You'll get:
```
ModuleNotFoundError: No module named 'shared'
```

## Restart after adding routes

When you add a new router file (e.g. `app/routers/tts.py`) or register it
in `__init__.py`/`main.py`, the running server won't pick it up — FastAPI
dev mode only watches existing files for content changes, not new file
creation or import tree changes. Kill and restart.

```bash
pkill -f "fastapi|uvicorn" && sleep 1
cd apps/api && PYTHONPATH=apps/api:../../packages:.. uv run fastapi dev --port 8000
```

## Run tests

```bash
cd apps/api && PYTHONPATH=apps/api:../../packages:.. uv run pytest -x -q
```

## Verify a route exists

```bash
curl -s http://localhost:8000/healthz
curl -s http://localhost:8000/docs | grep -o '/tts/speak'
```
