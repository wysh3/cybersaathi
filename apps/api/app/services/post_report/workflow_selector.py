from __future__ import annotations

from typing import Literal
from pydantic import BaseModel

from app.models import ComplaintRecord

WorkflowId = Literal[
    "money_movement_fraud",
    "identity_account_control",
    "personal_safety_extortion",
    "device_data_compromise",
    "platform_content_suspect",
]

WORKFLOWS: set[str] = {
    "money_movement_fraud",
    "identity_account_control",
    "personal_safety_extortion",
    "device_data_compromise",
    "platform_content_suspect",
}

class WorkflowSelection(BaseModel):
    primary_workflow: WorkflowId
    secondary_workflows: list[WorkflowId]
    reasons: list[str]
    risk_level: Literal["low", "medium", "high", "critical"]

def select_workflows(complaint: ComplaintRecord) -> WorkflowSelection:
    fraud_type = complaint.fraud_type.lower()
    amount = complaint.amount
    payment_method = complaint.payment_method.lower()
    summary = complaint.summary.lower()

    primary: WorkflowId = "platform_content_suspect"
    secondaries: list[WorkflowId] = []
    reasons: list[str] = []

    # Detect signals in narrative
    has_money_loss = amount > 0 or payment_method not in ("none", "auto", "unknown")
    has_threats = any(k in summary for k in ("threat", "kill", "harm", "police", "arrest", "abuse", "leak", "video", "photo"))
    has_credentials_exposed = any(k in summary for k in ("password", "otp", "login", "hacked", "credential", "credential stealer"))
    has_kyc_shared = any(k in summary for k in ("aadhaar", "pan", "kyc", "document", "id card"))
    has_malware_remote = any(k in summary for k in ("apk", "app", "installed", "malware", "virus", "ransomware", "anydesk", "teamviewer"))

    if fraud_type in WORKFLOWS:
        primary = fraud_type  # type: ignore[assignment]
        reasons.append("Canonical workflow category was already assigned.")
        if primary == "money_movement_fraud":
            secondaries.append("platform_content_suspect")
            reasons.append("Payment identifiers, profiles, apps, or messages may need platform reporting.")
        if primary != "money_movement_fraud" and has_money_loss:
            secondaries.append("money_movement_fraud")
            reasons.append("Money movement or active payment pressure was also reported.")
        if primary != "personal_safety_extortion" and has_threats:
            secondaries.append("personal_safety_extortion")
            reasons.append("Threats, coercion, or safety distress were also detected.")
        if primary != "identity_account_control" and (has_credentials_exposed or has_kyc_shared):
            secondaries.append("identity_account_control")
            reasons.append("Account credentials or identity documents are also at risk.")
        if primary != "device_data_compromise" and has_malware_remote:
            secondaries.append("device_data_compromise")
            reasons.append("Device or data compromise signals were also detected.")

    # Priority 1: W3 personal_safety_extortion
    # If explicit threat/coercion, harassment, stalking, deepfake sexual abuse
    elif (
        fraud_type in ("sextortion", "harassment", "stalking", "threats_of_violence", "deepfake_ncii")
        or (fraud_type == "digital_arrest" and has_threats)
    ):
        primary = "personal_safety_extortion"
        reasons.append("Personal safety, coercion, or harassment was detected as the primary concern.")
        if has_money_loss:
            secondaries.append("money_movement_fraud")
            reasons.append("Financial transactions were reported under pressure.")
        if has_credentials_exposed or has_kyc_shared:
            secondaries.append("identity_account_control")
            reasons.append("Account credentials or identity documents were compromised.")

    # Priority 2: W1 money_movement_fraud
    elif (
        fraud_type in (
            "upi_fraud", "banking_fraud", "wallet_fraud", "online_payment_fraud",
            "card_fraud", "aeps_fraud", "fake_refund", "investment_scam",
            "crypto_scam", "job_scam", "loan_scam", "non_delivery", "digital_arrest"
        )
        or (fraud_type == "phishing" and has_money_loss)
        or (fraud_type == "bec_email_takeover" and has_money_loss)
    ):
        primary = "money_movement_fraud"
        reasons.append("Direct financial transfer or money movement is the primary issue.")
        
        # Determine secondary workflows
        if fraud_type in ("banking_fraud", "card_fraud", "wallet_fraud", "aeps_fraud", "fake_refund", "loan_scam") or has_credentials_exposed or has_kyc_shared:
            secondaries.append("identity_account_control")
            reasons.append("Associated account access or KYC documents are at risk.")
        
        if fraud_type in ("upi_fraud", "online_payment_fraud", "investment_scam", "crypto_scam", "job_scam", "non_delivery"):
            secondaries.append("platform_content_suspect")
            reasons.append("Scam identifiers (phone, UPI handle, or URL) require platform reporting.")
            
        if fraud_type == "digital_arrest" and has_threats:
            secondaries.append("personal_safety_extortion")
            reasons.append("Impersonation threats were used to extract funds.")
        elif fraud_type == "digital_arrest" and has_kyc_shared:
            secondaries.append("identity_account_control")
            reasons.append("Government identity documents were shared under duress.")

    # Priority 3: W4 device_data_compromise
    elif (
        fraud_type in ("ransomware", "malware", "remote_access_scam")
        or (fraud_type == "fake_app" and has_malware_remote)
    ):
        primary = "device_data_compromise"
        reasons.append("Device infection, remote control, or data encryption detected.")
        if has_money_loss:
            secondaries.append("money_movement_fraud")
            reasons.append("Funds were paid as ransom or through remote manipulation.")
        if has_credentials_exposed or fraud_type == "malware":
            secondaries.append("identity_account_control")
            reasons.append("Account credentials or browser data may have been exfiltrated.")

    # Priority 4: W2 identity_account_control
    elif (
        fraud_type in ("account_hack", "sim_swap", "identity_theft", "data_breach", "bec_email_takeover")
        or (fraud_type == "phishing" and has_credentials_exposed)
    ):
        primary = "identity_account_control"
        reasons.append("Unauthorized account access or identity misuse is the primary concern.")
        if has_money_loss:
            secondaries.append("money_movement_fraud")
            reasons.append("Fraudulent transactions occurred after account compromise.")
        if fraud_type == "data_breach":
            secondaries.append("device_data_compromise")
            reasons.append("Associated systems or networks require containment.")

    # Priority 5: W5 platform_content_suspect
    else:
        primary = "platform_content_suspect"
        reasons.append("Reporting suspicious listings, links, or platform content.")
        if has_money_loss:
            secondaries.append("money_movement_fraud")
            reasons.append("A financial transaction occurred on the suspect platform.")
        if has_threats:
            secondaries.append("personal_safety_extortion")
            reasons.append("The suspect profile engaged in threatening behavior.")

    # Remove duplicates from secondaries and cap to maximum 2
    seen = set()
    unique_secondaries = []
    for s in secondaries:
        if s != primary and s not in seen:
            seen.add(s)
            unique_secondaries.append(s)
    
    # Risk assessment
    risk_level: Literal["low", "medium", "high", "critical"] = "medium"
    if primary == "personal_safety_extortion" or has_threats:
        risk_level = "critical"
    elif amount >= 10000 or primary == "device_data_compromise":
        risk_level = "high"
    elif amount > 0:
        risk_level = "medium"
    else:
        risk_level = "low"

    return WorkflowSelection(
        primary_workflow=primary,
        secondary_workflows=unique_secondaries[:2],
        reasons=reasons,
        risk_level=risk_level,
    )
