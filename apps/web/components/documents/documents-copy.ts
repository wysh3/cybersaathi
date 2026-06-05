/**
 * Documents-page copy and the Indian escalation list that drives the
 * adaptive InvestigationChecklist.
 *
 * InvestigationChecklist step persistence is owned by F008 (Documents
 * and evidence polish). F005 ships the visual surface and the read
 * contract from useWorkflowStore: helplineReference, currentStep, and
 * the presence of generated documents. Steps not yet tracked by the
 * store are rendered as todo with the right copy.
 */

export type InvestigationStepKey =
  | "helpline_called"
  | "bank_hold"
  | "ncrp_filed"
  | "bank_dispute_email"
  | "bank_followup"
  | "police_visit"
  | "consumer_forum";

export interface InvestigationStep {
  key: InvestigationStepKey;
  title: string;
  description: string;
}

export const INVESTIGATION_STEPS: ReadonlyArray<InvestigationStep> = [
  {
    key: "helpline_called",
    title: "Call 1930 helpline and save the reference number",
    description:
      "Reporting quickly may improve fund-blocking chances. We never guarantee recovery.",
  },
  {
    key: "bank_hold",
    title: "Place a hold with the receiving bank or payment app",
    description:
      "Ask 1930 to alert the receiving bank, and call your bank's nodal officer so a hold can be placed on the disputed amount.",
  },
  {
    key: "ncrp_filed",
    title: "File the NCRP complaint at cybercrime.gov.in",
    description:
      "Use the editable NCRP draft from the package. Attach the screenshots and the 1930 reference number when you submit.",
  },
  {
    key: "bank_dispute_email",
    title: "Email the bank nodal officer with the disputed transaction",
    description:
      "Send the bank dispute email from your registered email ID and keep a copy for follow-up.",
  },
  {
    key: "bank_followup",
    title: "Follow up with the bank in writing within 3 days",
    description:
      "If you do not receive a written response within 3 working days, escalate to the next step.",
  },
  {
    key: "police_visit",
    title: "Visit the cyber crime police station if no response within 7 days",
    description:
      "Carry the printed case file from the Documents tab, the helpline reference, and any bank correspondence.",
  },
  {
    key: "consumer_forum",
    title: "If still unresolved, escalate to the state consumer forum",
    description:
      "The consumer forum route is a last resort. Keep your full case file and a record of every prior step.",
  },
];

/**
 * Pre-written family alert text in Hindi + English. The link builder
 * uses this with a `wa.me/?text=` deep link so the victim can forward
 * it via WhatsApp without leaving the page.
 */
export const FAMILY_ALERT_HINDI =
  "CyberSaathi se ek important request hai: agar aapko koi unknown link, OTP request, ya payment demand aaye, please mujhse pehle confirm karein. Pichle 60 minute mein cyber fraud ka chance sabse zyada hota hai. Main safe hoon, lekin savadhani zaroori hai. Thank you.";

export const FAMILY_ALERT_ENGLISH =
  "A quick request from CyberSaathi: if you receive any unknown link, OTP request, or payment demand, please confirm with me before acting. The first 60 minutes after a fraud attempt are the most dangerous. I am safe, but please stay alert. Thank you.";

export function buildFamilyAlertLink(preferredLanguage: "hi" | "en" | "both" = "both"): string {
  const text =
    preferredLanguage === "hi"
      ? FAMILY_ALERT_HINDI
      : preferredLanguage === "en"
        ? FAMILY_ALERT_ENGLISH
        : `${FAMILY_ALERT_HINDI}\n\n${FAMILY_ALERT_ENGLISH}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
