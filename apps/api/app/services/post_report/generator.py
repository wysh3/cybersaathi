from __future__ import annotations

import os
import uuid
import hashlib
from datetime import datetime, timezone
from typing import Literal, Optional

from app.models import (
    ComplaintRecord,
    PostReportResponse,
    PostReportCard,
    PostReportItem,
    OfficialPath,
    FollowUpScheduleItem,
    PostReportStepState,
)
from app.services.seed_loader import get_seed_store, utcnow
from app.services.post_report.workflow_selector import select_workflows, WorkflowSelection

# Static definitions of workflow cards, do_not_dos, evidence, paths, and timelines for the deterministic fallback.
STATIC_TEMPLATES = {
    "money_movement_fraud": {
        "headline": "Next: report the transaction and preserve payment evidence",
        "cards": [
            {
                "id": "immediate_action",
                "title": "Immediate action",
                "priority": 1,
                "items": [
                    {
                        "label": "Call 1930 now",
                        "reason": "Recent financial fraud may still be within the fund-blocking window.",
                        "deadline": "immediate",
                        "uses_case_fields": ["amount", "incident_at", "payment_method"],
                    },
                    {
                        "label": "Contact bank/payment provider nodal officer in writing",
                        "reason": "Stop further transactions and formally dispute the charge.",
                        "deadline": "today",
                        "uses_case_fields": ["bank", "payment_app"],
                    }
                ]
            },
            {
                "id": "official_report",
                "title": "Official report",
                "priority": 2,
                "items": [
                    {
                        "label": "File NCRP complaint at cybercrime.gov.in",
                        "reason": "Formal cybercrime record required for legal investigation.",
                        "deadline": "today",
                        "uses_case_fields": ["utr", "upi_id", "amount"],
                    }
                ]
            }
        ],
        "do_not_do": [
            "Do not send more money or pay 'fees/taxes' to withdraw funds.",
            "Do not share bank OTP, passwords, UPI PIN, or CVV.",
            "Do not trust online 'recovery agents' claiming they can hack back your funds."
        ],
        "evidence_to_preserve": [
            "Transaction SMS notifications and bank statement screenshots.",
            "UTR / 12-digit transaction reference numbers.",
            "UPI ID, phone number, or bank account of the receiver.",
            "Chat logs and caller profiles."
        ],
        "official_paths": [
            {
                "label": "NCRP Complaint",
                "url": "https://cybercrime.gov.in",
                "mode": "user_opens_external",
                "note": "CyberSaathi prepared this draft; the victim must submit it on the official portal."
            }
        ],
        "follow_up_schedule": [
            {"after": "3_days", "action": "Follow up with bank nodal officer registered email ID to verify holds."},
            {"after": "7_days", "action": "Visit nearest cyber crime police station if no NCRP status updates."}
        ],
        "generated_document_kinds": ["ncrp_complaint_draft", "bank_dispute_email", "evidence_timeline", "recovery_checklist"]
    },
    "identity_account_control": {
        "headline": "Next: secure your login credentials and check KYC misuse",
        "cards": [
            {
                "id": "account_security",
                "title": "Account security",
                "priority": 1,
                "items": [
                    {
                        "label": "Change passwords from a clean device",
                        "reason": "Prevent subsequent logins by the unauthorized actor.",
                        "deadline": "immediate",
                        "uses_case_fields": ["handle"],
                    },
                    {
                        "label": "Enable Multi-Factor Authentication (MFA)",
                        "reason": "Adds an extra layer of protection even if credentials leak.",
                        "deadline": "24_hours",
                        "uses_case_fields": [],
                    },
                    {
                        "label": "Revoke active sessions and unknown connected apps",
                        "reason": "Terminate any open access tokens the attacker is currently using.",
                        "deadline": "immediate",
                        "uses_case_fields": [],
                    }
                ]
            },
            {
                "id": "platform_action",
                "title": "Platform action",
                "priority": 2,
                "items": [
                    {
                        "label": "Submit an account compromise report to the platform helpdesk",
                        "reason": "Regain ownership of the profile and notify support of impersonation.",
                        "deadline": "today",
                        "uses_case_fields": ["handle", "url"],
                    }
                ]
            }
        ],
        "do_not_do": [
            "Do not share screen-sharing codes (e.g. AnyDesk, TeamViewer) or MFA recovery keys.",
            "Do not click recovery links sent via unsolicited messages."
        ],
        "evidence_to_preserve": [
            "Security alert emails showing unauthorized login time/devices.",
            "Original profile details and screenshots of modified handles.",
            "Platform support ticket reference numbers."
        ],
        "official_paths": [
            {
                "label": "NCRP Report",
                "url": "https://cybercrime.gov.in",
                "mode": "user_opens_external",
                "note": "Report unauthorized identity profile usage to law enforcement."
            }
        ],
        "follow_up_schedule": [
            {"after": "24_hours", "action": "File NCRP update if sensitive identity documents (Aadhaar/PAN) were shared."},
            {"after": "3_days", "action": "Check CIBIL / credit bureau alerts for unauthorized loan queries."}
        ],
        "generated_document_kinds": ["ncrp_complaint_draft", "evidence_timeline", "recovery_checklist"]
    },
    "personal_safety_extortion": {
        "headline": "Next: prioritize safety, halt communication, and report sensitive abuse",
        "cards": [
            {
                "id": "immediate_action",
                "title": "Immediate action",
                "priority": 1,
                "items": [
                    {
                        "label": "Call 112 if in immediate physical danger",
                        "reason": "Standard police emergency dispatch for active threats.",
                        "deadline": "immediate",
                        "uses_case_fields": [],
                    },
                    {
                        "label": "Halt all contact and block the sender",
                        "reason": "Blackmailers escalate demands when they see active compliance.",
                        "deadline": "immediate",
                        "uses_case_fields": ["phone", "handle"],
                    }
                ]
            },
            {
                "id": "official_report",
                "title": "Official report",
                "priority": 2,
                "items": [
                    {
                        "label": "Report to NCRP women/children section (anonymous option available)",
                        "reason": "Dedicated portal for handling NCII / sexual extortion cases.",
                        "deadline": "today",
                        "uses_case_fields": [],
                    }
                ]
            },
            {
                "id": "platform_action",
                "title": "Platform action",
                "priority": 3,
                "items": [
                    {
                        "label": "File a takedown report with the hosting platform",
                        "reason": "Trigger automated hash matching to block image sharing.",
                        "deadline": "24_hours",
                        "uses_case_fields": ["url"],
                    }
                ]
            }
        ],
        "do_not_do": [
            "Do not delete chat history before saving screenshots as evidence.",
            "Do not pay the extortionist (demands will repeat)."
        ],
        "evidence_to_preserve": [
            "Full screenshots of blackmail threats including profile URLs and numbers.",
            "Links to any shared media or threat uploads.",
            "Call logs, phone numbers, and payment details if requested."
        ],
        "official_paths": [
            {
                "label": "NCRP Women & Children Portal",
                "url": "https://cybercrime.gov.in",
                "mode": "user_opens_external",
                "note": "File sensitive cases anonymously if required."
            },
            {
                "label": "National Commission for Women (NCW)",
                "url": "http://ncw.nic.in",
                "mode": "user_opens_external",
                "note": "Access legal support desks for women."
            }
        ],
        "follow_up_schedule": [
            {"after": "immediate", "action": "Access local mental health support or contact family members."},
            {"after": "24_hours", "action": "Update platform takedown tickets."}
        ],
        "generated_document_kinds": ["ncrp_complaint_draft", "evidence_timeline"]
    },
    "device_data_compromise": {
        "headline": "Next: isolate systems, scan malware, and restore from backups",
        "cards": [
            {
                "id": "device_containment",
                "title": "Device containment",
                "priority": 1,
                "items": [
                    {
                        "label": "Disconnect infected devices from local networks",
                        "reason": "Limit lateral movement to other home or business devices.",
                        "deadline": "immediate",
                        "uses_case_fields": [],
                    },
                    {
                        "label": "Do not format or wipe the drive yet",
                        "reason": "Preserves logs and evidence necessary for forensic tracking.",
                        "deadline": "immediate",
                        "uses_case_fields": [],
                    }
                ]
            },
            {
                "id": "account_security",
                "title": "Account security",
                "priority": 2,
                "items": [
                    {
                        "label": "Change critical credentials from a clean, separate device",
                        "reason": "Avoid keyloggers capturing updated passwords.",
                        "deadline": "24_hours",
                        "uses_case_fields": [],
                    }
                ]
            }
        ],
        "do_not_do": [
            "Do not enter passwords or bank credentials on the compromised device.",
            "Do not pay ransomware demands (files are rarely recovered this way)."
        ],
        "evidence_to_preserve": [
            "Ransom note screenshot and payment wallet addresses.",
            "Name and file package of the malicious APK or software.",
            "System log entries and altered file extensions."
        ],
        "official_paths": [
            {
                "label": "NCRP Report",
                "url": "https://cybercrime.gov.in",
                "mode": "user_opens_external",
                "note": "File system hacks and database intrusions."
            }
        ],
        "follow_up_schedule": [
            {"after": "24_hours", "action": "Run antivirus scans on separate network machines."},
            {"after": "3_days", "action": "Retrieve clean, offline system backups."}
        ],
        "generated_document_kinds": ["ncrp_complaint_draft", "evidence_timeline"]
    },
    "platform_content_suspect": {
        "headline": "Next: report suspect identifiers and protect others from fraud",
        "cards": [
            {
                "id": "platform_action",
                "title": "Platform action",
                "priority": 1,
                "items": [
                    {
                        "label": "Report URL or app listing to platform support",
                        "reason": "Prevent hosting services from serving the malicious page to others.",
                        "deadline": "today",
                        "uses_case_fields": ["url"],
                    },
                    {
                        "label": "Submit suspect indicators to I4C / NCRP suspect registry",
                        "reason": "Aggregates indicators like scam WhatsApp numbers or domain URLs.",
                        "deadline": "today",
                        "uses_case_fields": ["phone", "handle", "url"],
                    }
                ]
            }
        ],
        "do_not_do": [
            "Do not interact with the suspect site, links, or download attachments.",
            "Do not enter private information on suspected portals."
        ],
        "evidence_to_preserve": [
            "Full URL path and screenshots of the listing/page.",
            "Metadata: SMS headers, WhatsApp handle metadata, or Telegram link profiles."
        ],
        "official_paths": [
            {
                "label": "NCRP Report Suspect",
                "url": "https://cybercrime.gov.in/Webform/cyber_suspect.aspx",
                "mode": "user_opens_external",
                "note": "Register suspicious profiles, emails, or phone numbers."
            }
        ],
        "follow_up_schedule": [
            {"after": "7_days", "action": "Re-check URL status (verify platform took it down)."}
        ],
        "generated_document_kinds": ["ncrp_complaint_draft", "evidence_timeline"]
    }
}

def generate_post_report_response(
    complaint_id: str,
    force_refresh: bool = False,
    preferred_language: str = "en",
    completed_steps: Optional[dict[str, bool]] = None
) -> PostReportResponse:
    store = get_seed_store()
    
    # 1. Fetch the complaint
    complaint = store.complaint(complaint_id)
    if not complaint:
        raise ValueError(f"Complaint {complaint_id} not found.")

    # 2. Check if there's already a cached response and we aren't forcing a refresh
    if not force_refresh:
        existing = store.get_post_report_response(complaint_id)
        if existing:
            # Sync step states back to cards if they exist
            existing_steps = store.get_post_report_steps(complaint_id)
            step_map = {s.step_key: s.status for s in existing_steps}
            for card in existing.cards:
                for item in card.items:
                    if item.label in step_map:
                        item.status = step_map[item.label]
            return existing

    # 3. Deterministic selection
    selection: WorkflowSelection = select_workflows(complaint)
    primary = selection.primary_workflow
    secondaries = selection.secondary_workflows

    # 4. Check if LLM is enabled and try to invoke NIM
    llm_enabled = os.environ.get("LLM_ENABLED", "false").lower() == "true"
    nvidia_key = os.environ.get("NVIDIA_API_KEY", "")
    
    response_data = None
    if llm_enabled and nvidia_key:
        try:
            response_data = _invoke_nim_llm(complaint, selection, preferred_language)
        except Exception as e:
            # Fallback to static template on LLM failure
            pass

    # 5. Build response from static templates (fallback)
    if not response_data:
        response_data = _build_from_static(complaint, selection)

    # 6. Re-sync checked-off steps from the store
    existing_steps = store.get_post_report_steps(complaint_id)
    step_map = {s.step_key: s.status for s in existing_steps}
    
    # Also handle the initial request pre-completed steps
    if completed_steps:
        for k, done in completed_steps.items():
            # e.g., mapping keys like "ncrp_filed" or "bank_contacted"
            # We can lookup items containing "1930", "NCRP", or "bank"
            pass

    # Update item statuses in cards
    for card in response_data.cards:
        for item in card.items:
            # Seed the step in the store if it does not exist
            step_record = next((s for s in existing_steps if s.step_key == item.label and s.workflow_id == response_data.primary_workflow), None)
            if step_record:
                item.status = step_record.status
            else:
                # Create step in store as todo
                uid = f"st-{uuid.uuid4().hex[:10]}"
                new_step = PostReportStepState(
                    id=uid,
                    complaint_id=complaint_id,
                    workflow_id=response_data.primary_workflow,
                    step_key=item.label,
                    status="todo"
                )
                store.add_post_report_step(new_step)

    # 7. Persist generated response
    store.add_post_report_response(response_data)
    
    return response_data

def _build_from_static(complaint: ComplaintRecord, selection: WorkflowSelection) -> PostReportResponse:
    primary = selection.primary_workflow
    secondaries = selection.secondary_workflows

    primary_data = STATIC_TEMPLATES[primary]
    
    # Headline and risk details
    headline = primary_data["headline"]
    risk_level = selection.risk_level
    
    # Compile cards
    cards: list[PostReportCard] = []
    
    # Load primary cards
    for idx, card_dict in enumerate(primary_data["cards"]):
        items = [
            PostReportItem(
                label=item["label"],
                reason=item["reason"],
                status="todo",
                deadline=item["deadline"],  # type: ignore
                uses_case_fields=item["uses_case_fields"]
            )
            for item in card_dict["items"]
        ]
        cards.append(PostReportCard(
            id=card_dict["id"],
            title=card_dict["title"],
            priority=idx + 1,
            items=items
        ))

    # Add secondary cards if any
    for s_wf in secondaries:
        s_data = STATIC_TEMPLATES[s_wf]
        for idx, card_dict in enumerate(s_data["cards"]):
            # Avoid repeating cards of the same ID
            if any(c.id == card_dict["id"] for c in cards):
                continue
            items = [
                PostReportItem(
                    label=item["label"],
                    reason=item["reason"],
                    status="todo",
                    deadline=item["deadline"],  # type: ignore
                    uses_case_fields=item["uses_case_fields"]
                )
                for item in card_dict["items"]
            ]
            cards.append(PostReportCard(
                id=card_dict["id"],
                title=f"{card_dict['title']} (Secondary)",
                priority=len(cards) + 1,
                items=items
            ))

    # Compile do_not_dos and evidence
    do_not_do = list(primary_data["do_not_do"])
    evidence = list(primary_data["evidence_to_preserve"])
    official_paths = [OfficialPath.model_validate(p) for p in primary_data["official_paths"]]
    follow_up_schedule = [FollowUpScheduleItem.model_validate(s) for s in primary_data["follow_up_schedule"]]
    doc_kinds = list(primary_data["generated_document_kinds"])

    # Merge secondary lists without duplication
    for s_wf in secondaries:
        s_data = STATIC_TEMPLATES[s_wf]
        for d in s_data["do_not_do"]:
            if d not in do_not_do:
                do_not_do.append(d)
        for e in s_data["evidence_to_preserve"]:
            if e not in evidence:
                evidence.append(e)
        for p in s_data["official_paths"]:
            if not any(op.url == p["url"] for op in official_paths):
                official_paths.append(OfficialPath.model_validate(p))
        for doc in s_data["generated_document_kinds"]:
            if doc not in doc_kinds:
                doc_kinds.append(doc)

    uid = f"pr-{uuid.uuid4().hex[:10]}"
    return PostReportResponse(
        id=uid,
        complaint_id=complaint.id,
        primary_workflow=primary,
        secondary_workflows=secondaries,
        risk_level=risk_level,
        headline=headline,
        cards=cards,
        do_not_do=do_not_do,
        evidence_to_preserve=evidence,
        official_paths=official_paths,
        generated_document_kinds=doc_kinds,
        follow_up_schedule=follow_up_schedule,
        created_at=utcnow(),
        updated_at=utcnow()
    )

def _invoke_nim_llm(
    complaint: ComplaintRecord,
    selection: WorkflowSelection,
    preferred_language: str
) -> PostReportResponse:
    # This invokes Nvidia Nemotron-3-nano-30b-a3b via AsyncOpenAI to rephrase items.
    import json
    from openai import OpenAI
    
    client = OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=os.environ.get("NVIDIA_API_KEY")
    )
    
    # 1. Load context prompt
    # In a full setup we would read c:/CSE/cybersaathi/apps/api/app/services/post_report/prompts/workflows.md
    # Let's draft a clean prompt
    static_model = _build_from_static(complaint, selection)
    
    prompt = f"""
    You are CyberSaathi's Post-Report Checklist Rephraser.
    Your task is to rephrase and personalize the following draft checklists based on the victim's complaint summary.
    
    Complaint Summary:
    {complaint.summary}
    
    Primary Workflow: {selection.primary_workflow}
    Secondary Workflows: {selection.secondary_workflows}
    Risk Level: {selection.risk_level}
    
    Draft cards to rephrase:
    {static_model.model_dump_json()}
    
    Instruction:
    1. Rephrase the labels and reasons of the checklist items to refer to specific facts (like the amount Rs. {complaint.amount}, bank {complaint.payment_method}, or timeline) where relevant.
    2. Maintain absolute safety: never promise recovery, never say we filed anything, never ask for passwords/OTPs/PINs/Aadhaar/PAN.
    3. Return ONLY a valid JSON object matching the exact model structure of PostReportResponse.
    """
    
    completion = client.chat.completions.create(
        model="nvidia/nemotron-3-nano-30b-a3b",
        messages=[
            {"role": "system", "content": "You are a professional JSON assistant. Always return valid JSON matching the schema."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1,
        max_tokens=2000,
        extra_body={"chat_template_kwargs": {"enable_thinking": False}}
    )
    
    content = completion.choices[0].message.content
    data = json.loads(content)
    
    # Parse back into PostReportResponse
    return PostReportResponse.model_validate(data)
