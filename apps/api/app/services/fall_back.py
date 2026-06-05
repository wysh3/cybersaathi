"""Fall-Back Agent: scripted guided flow for edge cases.

The MVP is a constrained agent with three scripted edge cases:

1. Sextortion + UPI demand.
2. Job scam with multiple small payments over days.
3. Account hack with uncertain financial loss.

For each case we ask a small set of clarifying questions, then route back to
the correct pipeline (Golden Hour, Post-Golden-Hour, or Fall-Back continues).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from app.models import (
    ExtractedFacts,
    FallBackQuestion,
    FallBackTurnRequest,
    FallBackTurnResponse,
    GeoPoint,
    IntakeRequest,
    RoutingDecision,
)
from app.services.extraction import extract_facts
from app.services.redaction import redact_text
from app.services.routing import route_fall_back, route_intake


@dataclass
class FallBackCase:
    case_id: str
    case_type: str
    questions: list[FallBackQuestion] = field(default_factory=list)
    answers: dict[str, str] = field(default_factory=dict)
    current_step: str = "intake"
    description: str = ""
    extracted_facts: Optional[ExtractedFacts] = None
    history: list[dict] = field(default_factory=list)

    def to_response(self, notes: list[str], routing: RoutingDecision) -> FallBackTurnResponse:
        return FallBackTurnResponse(
            case_id=self.case_id,
            next_questions=self.questions,
            current_step=self.current_step,
            extracted_facts=self.extracted_facts or ExtractedFacts(),
            routing=routing,
            notes=notes,
        )


_CASES: dict[str, FallBackCase] = {}


SEXTORTION_QUESTIONS: list[FallBackQuestion] = [
    FallBackQuestion(
        id="threat_kind",
        prompt="What did the scammer threaten to do?",
        options=[
            "Share private photos or video with my contacts",
            "Post the content online",
            "Send the content to my family",
            "I am not sure yet",
        ],
    ),
    FallBackQuestion(
        id="money_demanded",
        prompt="Have you been asked to pay money to make the threat stop?",
        options=["Yes, once", "Yes, multiple times", "No, only threats so far"],
    ),
    FallBackQuestion(
        id="content_shared",
        prompt="Has any private content been shared so far?",
        options=["No", "Yes, with one or two people", "Yes, posted publicly"],
    ),
    FallBackQuestion(
        id="platform",
        prompt="Which platform did this start on?",
        options=["WhatsApp", "Instagram", "Telegram", "Other"],
    ),
]

JOB_QUESTIONS: list[FallBackQuestion] = [
    FallBackQuestion(
        id="job_channel",
        prompt="How did you find this job?",
        options=["WhatsApp message", "Telegram channel", "Instagram post", "Job portal", "Other"],
    ),
    FallBackQuestion(
        id="payment_count",
        prompt="How many times have you paid so far?",
        options=["Once", "Two or three times", "Four or more", "I have stopped paying"],
    ),
    FallBackQuestion(
        id="payment_method",
        prompt="Which payment method did you use?",
        options=["UPI", "Bank transfer", "Card", "Wallet"],
    ),
    FallBackQuestion(
        id="still_in_contact",
        prompt="Are you still in contact with the recruiter?",
        options=["Yes, they want more money", "They have gone silent", "I have blocked them"],
    ),
]

ACCOUNT_QUESTIONS: list[FallBackQuestion] = [
    FallBackQuestion(
        id="what_changed",
        prompt="What changed on your account?",
        options=[
            "Password changed and I cannot log in",
            "Messages sent from my account that I did not write",
            "Posts I did not make",
            "Money was taken",
        ],
        multi_select=True,
    ),
    FallBackQuestion(
        id="money_taken",
        prompt="Was money taken from any linked bank account or wallet?",
        options=["Yes, I see transactions I did not make", "I am not sure", "No, only my account was misused"],
    ),
    FallBackQuestion(
        id="recovered_account",
        prompt="Have you recovered access to the account?",
        options=["Yes", "No, I am locked out", "Partially, I can read but not change settings"],
    ),
]


def _detect_case_type(description: str) -> str:
    desc = description.lower()
    if any(t in desc for t in ("sextortion", "private photo", "private video", "nude", "blackmail")):
        return "sextortion"
    if any(t in desc for t in ("job", "interview", "salary", "registration fee", "task")):
        return "job_scam"
    if any(t in desc for t in ("hacked", "account hack", "can't login", "cannot login", "password changed", "lock out")):
        return "account_hack"
    return "generic"


def start_fall_back(description: str) -> FallBackTurnResponse:
    case_type = _detect_case_type(description)
    case_id = f"fb-{uuid.uuid4().hex[:10]}"
    case = FallBackCase(
        case_id=case_id,
        case_type=case_type,
        description=description,
    )
    if case_type == "sextortion":
        case.questions = SEXTORTION_QUESTIONS
    elif case_type == "job_scam":
        case.questions = JOB_QUESTIONS
    elif case_type == "account_hack":
        case.questions = ACCOUNT_QUESTIONS
    else:
        case.questions = [
            FallBackQuestion(
                id="confirm_type",
                prompt="What kind of incident is this?",
                options=[
                    "Money was sent (financial fraud)",
                    "Account was hacked",
                    "I received threats or blackmail",
                    "I received a suspicious job offer",
                    "Something else",
                ],
            )
        ]
    case.current_step = "clarify"
    _CASES[case_id] = case
    facts = extract_facts(description=description)
    request = IntakeRequest(description=description)
    routing = route_intake(request)
    routing.reasoning.append("Started Fall-Back guided flow for additional context.")
    case.extracted_facts = facts
    return case.to_response(
        notes=[
            "We are asking a few short questions so we can route you to the right next step.",
            "You can leave any answer blank if it does not apply.",
        ],
        routing=routing,
    )


def advance_fall_back(request: FallBackTurnRequest) -> FallBackTurnResponse:
    case = _CASES.get(request.case_id)
    if case is None:
        case = start_fall_back(request.description)
    case.description = request.description
    case.answers.update(request.answers)
    case.history.append({"step": case.current_step, "answers": dict(request.answers)})
    facts = extract_facts(
        description=request.description,
        evidence_text=request.evidence_text,
    )
    case.extracted_facts = facts
    notes: list[str] = []

    if case.case_type == "sextortion":
        notes.append(
            "Do not pay additional money. Preserve every chat and screenshot, and block the scammer."
        )
        if case.answers.get("money_demanded", "").startswith("Yes"):
            notes.append(
                "We detected a payment demand. We will route this to the post-golden-hour path so you can file an NCRP complaint and a bank dispute."
            )
    elif case.case_type == "job_scam":
        notes.append(
            "Recruiters who ask for money up front are running a scam. Stop further payments immediately."
        )
    elif case.case_type == "account_hack":
        if "money" in case.answers.get("what_changed", "").lower() or case.answers.get("money_taken", "").startswith("Yes"):
            notes.append(
                "You may have lost money. We will route this to the post-golden-hour path so you can build a complaint package."
            )

    routing_request = IntakeRequest(
        description=case.description + "\n" + " ".join(case.answers.values()),
        evidence_text=request.evidence_text,
    )
    routing = route_fall_back(
        routing_request,
        current_step=case.current_step,
        answers=case.answers,
    )
    if case.case_type == "sextortion" and case.answers.get("money_demanded", "").startswith("Yes"):
        if routing.pipeline != "post_golden_hour":
            routing = routing.model_copy(update={"pipeline": "post_golden_hour"})
            routing.reasoning.append("Sextortion + payment demand: switching to post-golden-hour complaint path.")
    if case.case_type == "account_hack" and (
        "money" in case.answers.get("what_changed", "").lower() or case.answers.get("money_taken", "").startswith("Yes")
    ):
        if routing.pipeline not in ("golden_hour", "post_golden_hour"):
            routing = routing.model_copy(update={"pipeline": "post_golden_hour"})
            routing.reasoning.append("Account hack with money loss: switching to post-golden-hour path.")

    case.questions = [] if routing.pipeline in ("golden_hour", "post_golden_hour") else case.questions
    case.current_step = "complete" if not case.questions else "clarify"
    return case.to_response(notes=notes, routing=routing)


def get_case(case_id: str) -> FallBackCase | None:
    return _CASES.get(case_id)
