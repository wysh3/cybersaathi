"""API launcher that adds the monorepo root to sys.path so that
``from packages.shared.constants import ...`` resolves correctly when the
FastAPI app is launched outside of uv's managed environment."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent         # apps/api
MONOREPO = ROOT.parent                       # apps
REPO_ROOT = MONOREPO.parent                  # <monorepo root>
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(MONOREPO))
sys.path.insert(0, str(REPO_ROOT / "packages"))

# Load .env if present
try:
    from dotenv import load_dotenv
    _env_path = ROOT / ".env"
    if _env_path.exists():
        load_dotenv(_env_path)
except ImportError:
    pass

import uvicorn  # noqa: E402

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        log_level="info",
        reload=False,
    )
