from __future__ import annotations

import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models import (
    PostReportResponse,
    PostReportResponseRequest,
    UpdatePostReportStepsRequest,
    PostReportStepState,
)
from app.services.seed_loader import get_seed_store, utcnow
from app.services.post_report.generator import generate_post_report_response

router = APIRouter(prefix="/post-report", tags=["post-report"])

@router.post("/{complaint_id}/response", response_model=PostReportResponse)
def create_response_route(
    complaint_id: str,
    payload: PostReportResponseRequest,
) -> PostReportResponse:
    try:
        return generate_post_report_response(
            complaint_id=complaint_id,
            force_refresh=payload.force_refresh,
            preferred_language=payload.preferred_language,
            completed_steps=payload.completed_steps
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

@router.get("/{complaint_id}/response", response_model=PostReportResponse)
def get_response_route(complaint_id: str) -> PostReportResponse:
    store = get_seed_store()
    response = store.get_post_report_response(complaint_id)
    if not response:
        # If it hasn't been generated yet, let's generate it deterministically
        try:
            response = generate_post_report_response(complaint_id=complaint_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
    else:
        # Sync step states back to card items
        existing_steps = store.get_post_report_steps(complaint_id)
        step_map = {s.step_key: s.status for s in existing_steps}
        for card in response.cards:
            for item in card.items:
                if item.label in step_map:
                    item.status = step_map[item.label]  # type: ignore
    return response

@router.patch("/{complaint_id}/steps")
def update_step_route(
    complaint_id: str,
    payload: UpdatePostReportStepsRequest,
) -> dict:
    store = get_seed_store()
    complaint = store.complaint(complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id} not found.")

    response = store.get_post_report_response(complaint_id)
    if not response:
        try:
            response = generate_post_report_response(complaint_id=complaint_id)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to initialize response workflows: {str(e)}")

    workflow_id = response.primary_workflow
    
    # Check if step state exists
    existing_steps = store.get_post_report_steps(complaint_id)
    step = next((s for s in existing_steps if s.step_key == payload.step_key), None)
    
    if not step:
        uid = f"st-{uuid.uuid4().hex[:10]}"
        step = PostReportStepState(
            id=uid,
            complaint_id=complaint_id,
            workflow_id=workflow_id,
            step_key=payload.step_key,
            status=payload.status,
            completed_at=utcnow() if payload.status == "done" else None,
            notes=payload.notes,
        )
    else:
        step = step.model_copy(update={
            "status": payload.status,
            "completed_at": utcnow() if payload.status == "done" else None,
            "notes": payload.notes,
        })
        
    store.add_post_report_step(step)
    return {"success": True}
