import { PrivacyNotice } from "@/components/app/PrivacyNotice";

/**
 * SubmissionReminderPanel — explicit "we never file on your behalf"
 * callout. Lives in the sidebar of the Documents page.
 */
export function SubmissionReminderPanel() {
  return (
    <PrivacyNotice title="Submission reminder" tone="alert">
      CyberSaathi generates drafts and never submits to NCRP or banks on
      your behalf. Open cybercrime.gov.in, paste the edited NCRP draft,
      attach screenshots, and submit. For the bank dispute, send the
      email from your registered email ID.
    </PrivacyNotice>
  );
}
