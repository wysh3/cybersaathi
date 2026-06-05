"""Repository layer — CRUD operations for PostgreSQL persistence.

Each repository wraps an async SQLAlchemy session and provides typed
methods that mirror the current SeedStore accessors so services can
switch from in-memory to Postgres with minimal churn.

Usage (inside a service or router):

    from app.services.repositories import ComplaintRepo, EvidenceRepo, ...
    from app.services.database import get_sessionmaker

    session = get_sessionmaker()()
    repo = ComplaintRepo(session)
    complaint = await repo.get("c-123")
"""

from .complaint import ComplaintRepo
from .evidence import EvidenceRepo
from .identifier import IdentifierRepo
from .session import SessionRepo
from .cluster import ClusterRepo
from .document import DocumentRepo
from .integration_event import IntegrationEventRepo
from .conversation import ConversationRepo

__all__ = [
    "ComplaintRepo",
    "EvidenceRepo",
    "IdentifierRepo",
    "SessionRepo",
    "ClusterRepo",
    "DocumentRepo",
    "IntegrationEventRepo",
    "ConversationRepo",
]
