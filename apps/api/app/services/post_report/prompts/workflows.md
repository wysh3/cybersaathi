# Post-Report Response Workflows Templates

This document contains instructions and static templates for generating the checklist cards, evidence tips, "do not do" constraints, official paths, and follow-up schedules.

---

## Workflows

### W1: money_movement_fraud
*   **Headline**: Next: report the transaction and preserve payment evidence
*   **Cards**:
    *   **immediate_action**:
        *   If recent (under 60 minutes): Call 1930 now. (Reason: Recent financial fraud may still be within the fund-blocking window. Deadline: immediate)
        *   If older (60+ minutes): Contact bank/payment provider nodal officer in writing. (Reason: Stop further transactions and formally dispute the charge. Deadline: today)
    *   **official_report**:
        *   File NCRP complaint at cybercrime.gov.in. (Reason: Formal cybercrime record required for legal investigation. Deadline: today)
*   **Do Not Do**:
    *   Do not send more money or pay "fees/taxes" to withdraw funds.
    *   Do not share bank OTP, passwords, UPI PIN, or CVV.
    *   Do not trust online "recovery agents" claiming they can hack back your funds.
*   **Evidence to Keep**:
    *   Transaction SMS notifications and bank statement screenshots.
    *   UTR / 12-digit transaction reference numbers.
    *   UPI ID, phone number, or bank account of the receiver.
    *   Chat logs and caller profiles.
*   **Official Paths**:
    *   NCRP Complaint: https://cybercrime.gov.in (mode: user_opens_external)
*   **Follow Up Schedule**:
    *   3 days: Follow up with bank nodal officer registered email ID to verify holds.
    *   7 days: Visit nearest cyber crime police station if no NCRP status updates.

---

### W2: identity_account_control
*   **Headline**: Next: secure your login credentials and check KYC misuse
*   **Cards**:
    *   **account_security**:
        *   Change passwords from a clean device. (Reason: Prevent subsequent logins by the unauthorized actor. Deadline: immediate)
        *   Enable Multi-Factor Authentication (MFA). (Reason: Adds an extra layer of protection even if credentials leak. Deadline: 24_hours)
        *   Revoke active sessions and unknown connected apps. (Reason: Terminate any open access tokens the attacker is currently using. Deadline: immediate)
    *   **platform_action**:
        *   Submit an account compromise report to the platform helpdesk. (Reason: Regain ownership of the profile and notify support of impersonation. Deadline: today)
*   **Do Not Do**:
    *   Do not share screen-sharing codes (e.g. AnyDesk, TeamViewer) or MFA recovery keys.
    *   Do not click recovery links sent via unsolicited messages.
*   **Evidence to Keep**:
    *   Security alert emails showing unauthorized login time/devices.
    *   Original profile details and screenshots of modified handles.
    *   Platform support ticket reference numbers.
*   **Official Paths**:
    *   NCRP Report: https://cybercrime.gov.in (mode: user_opens_external)
*   **Follow Up Schedule**:
    *   24 hours: File NCRP update if sensitive identity documents (Aadhaar/PAN) were shared.
    *   3 days: Check CIBIL / credit bureau alerts for unauthorized loan queries.

---

### W3: personal_safety_extortion
*   **Headline**: Next: prioritize safety, halt communication, and report sensitive abuse
*   **Cards**:
    *   **immediate_action**:
        *   If in immediate physical danger: Call 112. (Reason: Standard police emergency dispatch. Deadline: immediate)
        *   Halt all contact and block the sender. (Reason: Blackmailers escalate demands when they see active compliance. Deadline: immediate)
    *   **official_report**:
        *   Report to NCRP women/children section (anonymous option available). (Reason: Dedicated portal for handling NCII / sexual extortion cases. Deadline: today)
    *   **platform_action**:
        *   File a takedown report with the hosting platform. (Reason: Trigger automated hash matching to block image sharing. Deadline: 24_hours)
*   **Do Not Do**:
    *   Do not delete chat history before saving screenshots as evidence.
    *   Do not pay the extortionist (demands will repeat).
*   **Evidence to Keep**:
    *   Full screenshots of blackmail threats including profile URLs and numbers.
    *   Links to any shared media or threat uploads.
    *   Call logs, phone numbers, and payment details if requested.
*   **Official Paths**:
    *   NCRP Sensitive Path: https://cybercrime.gov.in (mode: user_opens_external)
    *   National Commission for Women (NCW): http://ncw.nic.in (mode: user_opens_external)
*   **Follow Up Schedule**:
    *   immediate: Access local mental health support or contact family members.
    *   24 hours: Update platform takedown tickets.

---

### W4: device_data_compromise
*   **Headline**: Next: isolate systems, scan malware, and restore from backups
*   **Cards**:
    *   **device_containment**:
        *   Disconnect infected devices from local networks. (Reason: Limit lateral movement to other home or business devices. Deadline: immediate)
        *   Do not format or wipe the drive yet. (Reason: Preserves logs and evidence necessary for forensic tracking. Deadline: immediate)
    *   **account_security**:
        *   Change critical credentials from a clean, separate device. (Reason: Avoid keyloggers capturing updated passwords. Deadline: 24_hours)
*   **Do Not Do**:
    *   Do not enter passwords or bank credentials on the compromised device.
    *   Do not pay ransomware demands (files are rarely recovered this way).
*   **Evidence to Keep**:
    *   Ransom note screenshot and payment wallet addresses.
    *   Name and file package of the malicious APK or software.
    *   System log entries and altered file extensions.
*   **Official Paths**:
    *   NCRP Report: https://cybercrime.gov.in (mode: user_opens_external)
*   **Follow Up Schedule**:
    *   24 hours: Run antivirus scans on separate network machines.
    *   3 days: Retrieve clean, offline system backups.

---

### W5: platform_content_suspect
*   **Headline**: Next: report suspect identifiers and protect others from fraud
*   **Cards**:
    *   **platform_action**:
        *   Report URL or app listing to platform support. (Reason: Prevent hosting services from serving the malicious page to others. Deadline: today)
        *   Submit suspect indicators to I4C / NCRP suspect registry. (Reason: Aggregates indicators like scam WhatsApp numbers or domain URLs. Deadline: today)
*   **Do Not Do**:
    *   Do not interact with the suspect site, links, or download attachments.
    *   Do not enter private information on suspected portals.
*   **Evidence to Keep**:
    *   Full URL path and screenshots of the listing/page.
    *   Metadata: SMS headers, WhatsApp handle metadata, or Telegram link profiles.
*   **Official Paths**:
    *   NCRP Report Suspect: https://cybercrime.gov.in/Webform/cyber_suspect.aspx (mode: user_opens_external)
*   **Follow Up Schedule**:
    *   7 days: Re-check URL status (verify platform took it down).
