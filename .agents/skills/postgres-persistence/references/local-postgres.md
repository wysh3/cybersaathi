# Local Postgres Commands

## Check

```bash
pg_isready -h 127.0.0.1 -p 5432
ss -ltnp | rg ':5432'
docker ps
```

## Example Docker Run

```bash
docker run --name cybersaathi-postgres \
  -e POSTGRES_USER=cybersaathi \
  -e POSTGRES_PASSWORD=cybersaathi \
  -e POSTGRES_DB=cybersaathi \
  -p 5432:5432 \
  -d postgis/postgis:16-3.4
```

## API In Postgres Mode

```bash
cd apps/api
DATABASE_URL=postgresql+asyncpg://cybersaathi:cybersaathi@127.0.0.1:5432/cybersaathi \
PYTHONPATH=.:../.. \
uv run python run_api.py
```

Postgres is the default runtime. Use `DATABASE_ENABLED=false` only for an
explicit in-memory fallback test.

## Seed

```bash
cd apps/api
DATABASE_URL=postgresql+asyncpg://cybersaathi:cybersaathi@127.0.0.1:5432/cybersaathi \
PYTHONPATH=.:../.. \
uv run python -m app.seed.seed_postgres
```
