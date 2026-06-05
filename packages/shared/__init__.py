"""CyberSaathi shared types and constants.

This package is a thin Python module to keep types and constants in one place
for the FastAPI service. The Next.js frontend re-uses the JSON seed data files
and consumes the API contract via HTTP. TypeScript types live in
``apps/web/lib/types``.
"""

from .constants import (
    FRAUD_TYPES,
    PAYMENT_METHODS,
    PIPELINES,
    SEVERITY_LEVELS,
    ACCOUNTABILITY_THRESHOLD,
    ACCOUNTABILITY_WINDOW_DAYS,
    GOLDEN_HOUR_MINUTES,
    PUBLIC_AUTHORITIES,
)

__all__ = [
    "FRAUD_TYPES",
    "PAYMENT_METHODS",
    "PIPELINES",
    "SEVERITY_LEVELS",
    "ACCOUNTABILITY_THRESHOLD",
    "ACCOUNTABILITY_WINDOW_DAYS",
    "GOLDEN_HOUR_MINUTES",
    "PUBLIC_AUTHORITIES",
]
