"""Fall-Back router: scripted guided flow for edge cases."""

from __future__ import annotations

from fastapi import APIRouter

from app.models import FallBackTurnRequest, FallBackTurnResponse
from app.services.fall_back import advance_fall_back, start_fall_back


router = APIRouter(prefix="/fall-back", tags=["fall-back"])


class StartFallBackRequest(FallBackTurnRequest):
    answers: dict[str, str] = {}


@router.post("/start", response_model=FallBackTurnResponse)
def start_fall_back_route(payload: StartFallBackRequest) -> FallBackTurnResponse:
    return start_fall_back(payload.description)


@router.post("/advance", response_model=FallBackTurnResponse)
def advance_fall_back_route(payload: FallBackTurnRequest) -> FallBackTurnResponse:
    return advance_fall_back(payload)
