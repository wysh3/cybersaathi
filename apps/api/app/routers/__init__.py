"""API router definitions.

Every router is declared with its prefix on the APIRouter so main.py can
include them with a single import. Each router returns a typed response
model, which keeps serialization consistent and filters sensitive fields.
"""

from .intake import router as intake_router
from .evidence import router as evidence_router
from .complaints import router as complaints_router
from .similarity import router as similarity_router
from .clusters import router as clusters_router
from .dashboards import router as dashboards_router
from .fall_back import router as fall_back_router
from .integrations import router as integrations_router
from .intake_chat import router as intake_chat_router
from .map import router as map_router
from .post_report import router as post_report_router

__all__ = [
    "intake_router",
    "evidence_router",
    "complaints_router",
    "similarity_router",
    "clusters_router",
    "dashboards_router",
    "fall_back_router",
    "integrations_router",
    "intake_chat_router",
    "map_router",
    "post_report_router",
]
