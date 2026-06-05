/**
 * Emergency constants shared by the Golden Hour cockpit.
 *
 * Hindi + English call scripts are kept in one place so the bilingual
 * copy block never drifts between the EmergencyClient and any future
 * page that needs the same call script (e.g. EducationNote variant).
 */

export const CALL_SCRIPT_HINDI = [
  "Namaskar, main apni cyber fraud ki report darj karna chahta/chahti hoon.",
  "Mera naam _____ hai aur main __________ (city) se call kar raha/rahi hoon.",
  "Aaj _____ baje, ek vyakti ne mujhe _____ (payment app) se Rs {amount} mangwa kar bhara diya.",
  "Receiver ka UPI ID: {upi_id}. Reference / UTR number: {utr}.",
  "Payment app / bank: {payment_app}. Scammer ka phone: {phone}.",
  "Maine apne bank ko abhi tak call nahi kiya. Kya aap meri bank ko turant alert kar sakte hain?",
  "Please mujhe ek reference number de dijiye, taaki main NCRP aur bank dispute use kar sakun.",
];

export const CALL_SCRIPT_ENGLISH = [
  "Hello, I want to register a cyber-fraud complaint. This is urgent — payment just happened.",
  "My name is _____ and I am calling from __________ (city).",
  "Today at _____, someone tricked me into paying Rs {amount} through {payment_app}.",
  "Receiver UPI ID: {upi_id}. Reference / UTR number: {utr}.",
  "Payment app / bank: {payment_app}. Scammer's phone: {phone}.",
  "I have not yet called my bank. Can you alert the receiving bank / wallet to place a hold on this amount?",
  "Please give me a reference number so I can attach it to my NCRP complaint and bank dispute email.",
];

export const DURING_CALL_CHECKLIST = [
  "Stay calm. Speak slowly. The operator is on your side.",
  "Have your phone ready in case the operator sends an SMS one-time password for verification.",
  "Read out the UTR, UPI ID, and amount exactly as captured in the case brief.",
  "Write down the reference number the operator gives you — it is required to attach to your NCRP and bank dispute drafts.",
  "Ask: should you also call your bank nodal officer now?",
  "Ask: how long until the disputed amount is placed on hold?",
  "If the operator asks for a screenshot, do not share OTPs, PINs, Aadhaar, or card numbers — share the transaction SMS only.",
];

export const DO_NOT_SHARE_REMINDER = [
  "OTP / one-time password",
  "ATM PIN or UPI PIN",
  "Aadhaar or PAN number",
  "Full card number, CVV, or expiry",
  "Netbanking password or username",
  "Any screenshot that shows the above",
];

/**
 * Format a number as Indian Rupees. Returns a neutral "—" when missing.
 */
export function formatAmount(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `Rs ${amount.toLocaleString("en-IN")}`;
}

/**
 * Format an ISO timestamp for the case-brief "Reported at" row.
 * Falls back to the raw string when the timestamp is malformed.
 */
export function formatIncidentLabel(timestamp: string | null | undefined): string {
  if (!timestamp) return "—";
  try {
    return new Date(timestamp).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return timestamp;
  }
}

export type CallScriptLanguage = "hi" | "en";
