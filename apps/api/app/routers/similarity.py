"""Similarity router: search the seed data for matching identifiers."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query

from app.models import SimilarityMatch, SimilarityResult
from app.services.similarity import similarity_for_complaint


router = APIRouter(prefix="/similarity", tags=["similarity"])


@router.get("", response_model=SimilarityResult)
def similarity_route(
    upi_id: Optional[str] = Query(default=None),
    phone: Optional[str] = Query(default=None),
    handle: Optional[str] = Query(default=None),
    url: Optional[str] = Query(default=None),
) -> SimilarityResult:
    from app.models import ExtractedFacts

    facts = ExtractedFacts(upi_id=upi_id, phone=phone, handle=handle, url=url)
    return similarity_for_complaint(facts)
