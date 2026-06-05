"""Intake router: classify the user's first description and start a session."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.models import GeoPoint, IntakeRequest, IntakeResponse
from app.services.intake import process_intake, start_session


router = APIRouter(prefix="/intake", tags=["intake"])


class StartSessionResponse(BaseModel):
    session_id: str


@router.post("/session", response_model=StartSessionResponse)
def start_session_route() -> StartSessionResponse:
    session = start_session()
    return StartSessionResponse(session_id=session["id"])


@router.post("/classify", response_model=IntakeResponse)
def classify_route(
    session_id: str,
    payload: IntakeRequest,
) -> IntakeResponse:
    return process_intake(session_id, payload)


class IntakeWithLocationRequest(IntakeRequest):
    location: GeoPoint | None = None


class ShallowCategory(BaseModel):
    """A non-cyber emergency category that CyberSaathi intentionally only
    supports with shallow, hand-curated guidance.

    These are surfaced on the intake page so the architecture visibly
    generalises to other government emergency flows, but the V1 product
    is cybercrime-first.
    """

    id: Literal["medical_emergency", "domestic_violence", "lost_documents"]
    label: str
    headline: str
    body: str
    primary_number: str
    primary_label: str
    support_lines: list[str] = Field(default_factory=list)
    status: Literal["coming_next", "shallow"] = "shallow"


class ShallowCategoriesResponse(BaseModel):
    categories: list[ShallowCategory]


@router.get("/shallow-categories", response_model=ShallowCategoriesResponse)
def shallow_categories_route() -> ShallowCategoriesResponse:
    return ShallowCategoriesResponse(
        categories=[
            ShallowCategory(
                id="medical_emergency",
                label="Medical emergency",
                headline="Life-threatening? Call 112 first.",
                body=(
                    "CyberSaathi is built for cybercrime. For life-threatening "
                    "medical emergencies we connect you to 112 / 108 and the "
                    "nearest government hospital, but we do not run a full "
                    "medical workflow."
                ),
                primary_number="112",
                primary_label="Call 112 (national emergency)",
                support_lines=[
                    "Ambulance / ER triage through 108.",
                    "Government hospital locator: health.pmjay.gov.in",
                    "Poison, snake-bite, and burns: redirect to medical helpline 104.",
                ],
                status="shallow",
            ),
            ShallowCategory(
                id="domestic_violence",
                label="Domestic violence",
                headline="If you are not safe right now, leave the page and call 181.",
                body=(
                    "CyberSaathi is built for cybercrime. For domestic "
                    "violence we surface 181 (Women Helpline) and 112, and "
                    "we will not store or display any narrative on this page. "
                    "A full domestic-violence workflow is planned for a later "
                    "release."
                ),
                primary_number="181",
                primary_label="Call 181 (Women Helpline)",
                support_lines=[
                    "National Commission for Women: 7827-170-170.",
                    "One-Stop Centre (Sakhi) directory: wcd.nic.in.",
                    "If there is immediate physical danger, call 112 first.",
                ],
                status="shallow",
            ),
            ShallowCategory(
                id="lost_documents",
                label="Lost documents",
                headline="FIR first, then online portal for re-issue.",
                body=(
                    "CyberSaathi is built for cybercrime. For lost Aadhaar, "
                    "PAN, or passport we surface the official re-issue "
                    "portals. A full lost-documents workflow with ID-expiry "
                    "tracking is planned for a later release."
                ),
                primary_number="1947",
                primary_label="Aadhaar helpline 1947",
                support_lines=[
                    "Aadhaar re-issue: uidai.gov.in",
                    "PAN re-issue: tin.tin.nsdl.com / e-filing portal",
                    "Passport: passport.gov.in — file an FIR at the nearest police station first.",
                ],
                status="shallow",
            ),
        ]
    )
