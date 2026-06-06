"""Admin Portal API routes — Police Authority Dashboard.

All endpoints under /api/admin/ are protected by JWT httpOnly cookie auth.
Role-based access control via `require_role` dependency.
"""

from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import func, select, text, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AdminComplaintsPage,
    AdminComplaintDetail,
    AdminComplaintListItem,
    AdminLoginRequest,
    AdminLoginResponse,
    AdminNoteItem,
    AdminNoteRequest,
    AdminStatsResponse,
    AdminStatusUpdateRequest,
)
from app.models.db import (
    AdminUserORM,
    AdminAuditLogORM,
    ComplaintORM,
    EvidenceItemORM,
    ClusterORM,
)
from app.services.admin_auth import (
    AdminUser,
    create_jwt,
    decode_jwt,
    set_auth_cookie,
    clear_auth_cookie,
    verify_password,
    get_current_admin,
    require_role,
    ensure_admin_users,
)
from app.services.database import get_async_session

router = APIRouter(prefix="/admin", tags=["admin"])

COMPLAINT_STATUSES = ["pending", "under_review", "escalated", "resolved", "rejected"]


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@router.post("/auth/login")
async def admin_login(
    body: AdminLoginRequest,
    session: AsyncSession = Depends(get_async_session),
):
    """Authenticate admin user and set JWT httpOnly cookie."""
    # Ensure seed users exist
    await ensure_admin_users(session)

    result = await session.execute(
        select(AdminUserORM).where(AdminUserORM.officer_id == body.officer_id)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials. Access attempt logged.")

    # Update last login
    user.last_login_at = datetime.now(tz=timezone.utc)
    await session.commit()

    token = create_jwt(user.officer_id, user.role, user.name)

    resp_data = AdminLoginResponse(
        success=True,
        officer_id=user.officer_id,
        name=user.name,
        role=user.role,
        message=f"Welcome, {user.name}. You are logged in as {user.role}.",
    )

    response = JSONResponse(content=resp_data.model_dump())
    set_auth_cookie(response, token)
    return response


@router.post("/auth/logout")
async def admin_logout():
    """Clear the auth cookie."""
    response = JSONResponse(content={"success": True, "message": "Logged out."})
    clear_auth_cookie(response)
    return response


@router.get("/auth/me")
async def admin_me(admin: AdminUser = Depends(get_current_admin)):
    """Return current admin user info from JWT."""
    return {
        "officer_id": admin.officer_id,
        "name": admin.name,
        "role": admin.role,
    }


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------

@router.get("/stats", response_model=AdminStatsResponse)
async def admin_stats(
    session: AsyncSession = Depends(get_async_session),
    admin: AdminUser = Depends(get_current_admin),
):
    """Get KPI stats for the admin dashboard."""
    # Total complaints
    total_result = await session.execute(select(func.count(ComplaintORM.id)))
    total = total_result.scalar() or 0

    # Pending / unresolved
    pending_result = await session.execute(
        select(func.count(ComplaintORM.id)).where(
            ComplaintORM.status.in_(["pending", "under_review", "escalated", "intake_in_progress", "evidence_under_review"])
        )
    )
    pending = pending_result.scalar() or 0

    # Resolved this week
    week_ago = datetime.now(tz=timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    # Count recently created resolved complaints or status changed ones
    resolved_result = await session.execute(
        select(func.count(ComplaintORM.id)).where(
            ComplaintORM.status == "resolved",
            ComplaintORM.created_at >= week_ago,
        )
    )
    resolved = resolved_result.scalar() or 0

    # Golden hour cases (pipeline == golden_hour) — use text() to avoid enum cast
    gh_result = await session.execute(
        text("SELECT count(id) FROM complaints WHERE pipeline = 'golden_hour'")
    )
    golden_hour = gh_result.scalar() or 0

    return AdminStatsResponse(
        total_complaints=total,
        pending_unresolved=pending,
        resolved_this_week=resolved,
        golden_hour_cases=golden_hour,
    )


# ---------------------------------------------------------------------------
# Complaints list (paginated, filtered)
# ---------------------------------------------------------------------------

@router.get("/complaints", response_model=AdminComplaintsPage)
async def admin_complaints_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    fraud_type: Optional[str] = Query(None),
    urgency: Optional[str] = Query(None),  # "golden_hour" or "post"
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    sort_by: str = Query("filed_at"),
    sort_dir: str = Query("desc"),
    session: AsyncSession = Depends(get_async_session),
    admin: AdminUser = Depends(get_current_admin),
):
    """Get paginated list of complaints with filters."""
    # Build base query
    query = select(ComplaintORM)
    count_query = select(func.count(ComplaintORM.id))

    # Apply filters
    conditions = []

    if search:
        search_term = f"%{search}%"
        conditions.append(
            ComplaintORM.summary.ilike(search_term)
        )

    if status:
        conditions.append(ComplaintORM.status == status)

    if fraud_type:
        conditions.append(ComplaintORM.fraud_type == fraud_type)

    if urgency == "golden_hour":
        conditions.append(text("complaints.pipeline = 'golden_hour'"))
    elif urgency == "post":
        conditions.append(text("complaints.pipeline != 'golden_hour'"))

    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from)
            conditions.append(ComplaintORM.created_at >= dt_from)
        except ValueError:
            pass

    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to)
            conditions.append(ComplaintORM.created_at <= dt_to)
        except ValueError:
            pass

    if conditions:
        query = query.where(and_(*conditions))
        count_query = count_query.where(and_(*conditions))

    # Count
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    # Sorting
    sort_col = getattr(ComplaintORM, sort_by, ComplaintORM.created_at)
    if sort_dir == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await session.execute(query)
    complaints = result.scalars().all()

    # Build response items
    items = []
    for c in complaints:
        # Determine urgency label
        urgent_label = (
            "Golden Hour" if c.pipeline == "golden_hour"
            else "Post Golden Hour" if c.pipeline == "post_golden_hour"
            else "Fall Back"
        )

        items.append(AdminComplaintListItem(
            id=c.id,
            fraud_type=c.fraud_type,
            amount_lost=c.amount,
            urgency=urgent_label,
            filed_at=c.created_at or c.incident_at,
            status=c.status,
            pipeline=c.pipeline,
            has_cluster=c.cluster_id is not None,
        ))

    return AdminComplaintsPage(
        complaints=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, (total + page_size - 1) // page_size),
    )


# ---------------------------------------------------------------------------
# Complaint detail (with evidence, notes, cluster)
# ---------------------------------------------------------------------------

@router.get("/complaints/{complaint_id}", response_model=AdminComplaintDetail)
async def admin_complaint_detail(
    complaint_id: str,
    session: AsyncSession = Depends(get_async_session),
    admin: AdminUser = Depends(get_current_admin),
):
    """Get full complaint detail including evidence, notes, and cluster info."""
    result = await session.execute(
        select(ComplaintORM).where(ComplaintORM.id == complaint_id)
    )
    complaint = result.scalar_one_or_none()

    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    # Get evidence items
    ev_result = await session.execute(
        select(EvidenceItemORM).where(EvidenceItemORM.complaint_id == complaint_id)
    )
    evidence = ev_result.scalars().all()
    evidence_items = [
        {
            "id": e.id,
            "kind": e.kind,
            "redacted_text": e.redacted_text[:500] if e.redacted_text else "",
            "extracted_fields": e.extracted_fields,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in evidence
    ]

    # Get notes from audit log
    notes_result = await session.execute(
        select(AdminAuditLogORM)
        .where(AdminAuditLogORM.complaint_id == complaint_id)
        .where(AdminAuditLogORM.action == "add_note")
        .order_by(AdminAuditLogORM.timestamp.desc())
    )
    notes = notes_result.scalars().all()
    note_items = [
        AdminNoteItem(
            id=n.id,
            officer_id=n.officer_id,
            officer_name=n.officer_name,
            note=n.note or "",
            timestamp=n.timestamp,
        )
        for n in notes
    ]

    # Cluster info
    cluster_report_count = None
    if complaint.cluster_id:
        c_result = await session.execute(
            select(ClusterORM).where(ClusterORM.id == complaint.cluster_id)
        )
        cluster = c_result.scalar_one_or_none()
        if cluster:
            cluster_report_count = cluster.report_count

    return AdminComplaintDetail(
        id=complaint.id,
        fraud_type=complaint.fraud_type,
        platform_used=complaint.payment_method or "",
        transaction_id="",  # extracted from evidence if available
        upi_id="",  # extracted from evidence if available
        amount=complaint.amount,
        description=complaint.summary or "",
        severity=complaint.severity or "medium",
        urgency_score=complaint.urgency_score or 0,
        pipeline=complaint.pipeline or "post_golden_hour",
        status=complaint.status,
        filed_at=complaint.created_at,
        incident_at=complaint.incident_at or complaint.created_at,
        state=complaint.state,
        district=complaint.district,
        evidence_items=evidence_items,
        cluster_id=complaint.cluster_id,
        cluster_report_count=cluster_report_count,
        notes=note_items,
        is_resolved=complaint.is_resolved,
        has_fir=complaint.has_fir,
    )


# ---------------------------------------------------------------------------
# Update complaint status (role-gated)
# ---------------------------------------------------------------------------

@router.patch("/complaints/{complaint_id}/status")
async def admin_update_status(
    complaint_id: str,
    body: AdminStatusUpdateRequest,
    session: AsyncSession = Depends(get_async_session),
    admin: AdminUser = Depends(get_current_admin),
):
    """Update complaint status. Resolved requires super_admin role."""
    if body.status == "resolved":
        if admin.role != "super_admin":
            raise HTTPException(status_code=403, detail="Only Super Admin can mark complaints as resolved.")

    result = await session.execute(
        select(ComplaintORM).where(ComplaintORM.id == complaint_id)
    )
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    old_status = complaint.status
    complaint.status = body.status
    if body.status == "resolved":
        complaint.is_resolved = True

    # Create audit log
    audit = AdminAuditLogORM(
        id=uuid.uuid4().hex[:12],
        complaint_id=complaint_id,
        officer_id=admin.officer_id,
        action="status_change",
        old_status=old_status,
        new_status=body.status,
        note=body.note,
        officer_name=admin.name,
        timestamp=datetime.now(tz=timezone.utc),
    )
    session.add(audit)
    await session.commit()

    return {
        "success": True,
        "complaint_id": complaint_id,
        "old_status": old_status,
        "new_status": body.status,
    }


# ---------------------------------------------------------------------------
# Add note to complaint
# ---------------------------------------------------------------------------

@router.post("/complaints/{complaint_id}/notes")
async def admin_add_note(
    complaint_id: str,
    body: AdminNoteRequest,
    session: AsyncSession = Depends(get_async_session),
    admin: AdminUser = Depends(get_current_admin),
):
    """Append a note to the complaint thread."""
    result = await session.execute(
        select(ComplaintORM).where(ComplaintORM.id == complaint_id)
    )
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    audit = AdminAuditLogORM(
        id=uuid.uuid4().hex[:12],
        complaint_id=complaint_id,
        officer_id=admin.officer_id,
        action="add_note",
        note=body.note,
        officer_name=admin.name,
        timestamp=datetime.now(tz=timezone.utc),
    )
    session.add(audit)
    await session.commit()

    return {
        "success": True,
        "note": AdminNoteItem(
            id=audit.id,
            officer_id=audit.officer_id,
            officer_name=audit.officer_name,
            note=audit.note or "",
            timestamp=audit.timestamp,
        ),
    }


# ---------------------------------------------------------------------------
# Export CSV (Super Admin only)
# ---------------------------------------------------------------------------

@router.get("/export")
async def admin_export_csv(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    fraud_type: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_async_session),
    admin: AdminUser = Depends(get_current_admin),
    _role: None = Depends(require_role("super_admin")),
):
    """Export filtered complaints as CSV (Super Admin only)."""
    query = select(ComplaintORM)
    conditions = []

    if search:
        conditions.append(ComplaintORM.summary.ilike(f"%{search}%"))
    if status:
        conditions.append(ComplaintORM.status == status)
    if fraud_type:
        conditions.append(ComplaintORM.fraud_type == fraud_type)
    if date_from:
        try:
            conditions.append(ComplaintORM.created_at >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            conditions.append(ComplaintORM.created_at <= datetime.fromisoformat(date_to))
        except ValueError:
            pass

    if conditions:
        query = query.where(and_(*conditions))

    query = query.order_by(ComplaintORM.created_at.desc())
    result = await session.execute(query)
    complaints = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Fraud Type", "Payment Method", "Amount (INR)", "Severity",
        "Pipeline", "Status", "State", "District", "Incident At", "Filed At",
        "Is Resolved", "Has FIR", "Summary",
    ])

    for c in complaints:
        writer.writerow([
            c.id, c.fraud_type, c.payment_method, c.amount, c.severity,
            c.pipeline, c.status, c.state, c.district,
            c.incident_at.isoformat() if c.incident_at else "",
            c.created_at.isoformat() if c.created_at else "",
            str(c.is_resolved), str(c.has_fir), c.summary or "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=cybersaathi_complaints_export.csv"},
    )


# ---------------------------------------------------------------------------
# Dashboard export types for the admin module
# ---------------------------------------------------------------------------

__all__ = ["router"]
