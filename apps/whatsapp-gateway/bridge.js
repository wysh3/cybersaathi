/**
 * CyberSaathi WhatsApp Gateway — bridge.js
 *
 * HTTP client that talks to the existing FastAPI intake endpoints.
 * Handles the full intake lifecycle: start → turn → confirm → routing.
 */

const API_BASE = process.env.CYBERSAATHI_API_URL || "http://127.0.0.1:8000";

/**
 * Session store: maps WhatsApp phone number → session state.
 *
 * Each entry:
 *   sessionId       — victim session ID from /start
 *   conversationId  — conversation ID for /turn and /confirm
 *   lastSnapshot    — CaseStateSnapshot from most recent turn response
 *   awaitingConfirm — true when bot asked "does this look right?"
 */
const sessions = new Map();

// ─── HTTP helper ────────────────────────────────────────────────────────────

async function apiPost(path, body) {
  const url = `${API_BASE}${path}`;
  console.log(`  → POST ${url}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "(no body)");
    throw new Error(`API ${res.status}: ${errText.slice(0, 300)}`);
  }
  return res.json();
}

// ─── Confirm intent detection ───────────────────────────────────────────────

const CONFIRM_WORDS = [
  "confirm", "yes", "y", "ok", "okay", "done",
  "looks right", "looks good", "looks correct",
  "correct", "right", "confirmed",
  "thik hai", "haan", "haanji", "ji haan",
  "sahi hai", "theek hai",
];

function isConfirmIntent(text) {
  const lowered = text.toLowerCase().trim().replace(/[.!]+$/, "");
  return CONFIRM_WORDS.some((w) => lowered === w || lowered.startsWith(w + " ") || lowered.endsWith(" " + w));
}

// ─── Text message handler ───────────────────────────────────────────────────

async function handleTextMessage(phone, text) {
  const session = sessions.get(phone);

  // ── First contact: start a new intake session ─────────────────────────
  if (!session) {
    const start = await apiPost("/intake/chat/start", {
      preferred_language: "en",
      contact_channel: "whatsapp",
    });

    const newSession = {
      sessionId: start.session_id,
      conversationId: start.conversation_id,
      lastSnapshot: start.case_snapshot || null,
      awaitingConfirm: false,
    };
    sessions.set(phone, newSession);

    return (
      start.message?.content_redacted ??
      start.message?.content ??
      "I'm here to help. Tell me what happened."
    );
  }

  // ── Awaiting confirmation + user says "confirm" → call /confirm ───────
  if (session.awaitingConfirm && isConfirmIntent(text)) {
    return await handleConfirm(phone, session);
  }

  // ── Normal conversation turn ──────────────────────────────────────────
  const turn = await apiPost(`/intake/chat/${session.conversationId}/turn`, {
    message: text,
    client_context: { timezone: "Asia/Kolkata", current_path: "/whatsapp" },
  });

  // Track state for confirmation detection
  session.lastSnapshot = turn.case_snapshot || null;
  session.awaitingConfirm =
    turn.case_snapshot?.next_action === "confirm_facts";

  return (
    turn.assistant_message?.content_redacted ??
    turn.assistant_message?.content ??
    "I received your message."
  );
}

// ─── Confirmation handler ───────────────────────────────────────────────────

async function handleConfirm(phone, session) {
  const snapshot = session.lastSnapshot;

  if (!snapshot) {
    // No snapshot stored — fall back to a normal turn
    session.awaitingConfirm = false;
    const turn = await apiPost(`/intake/chat/${session.conversationId}/turn`, {
      message: "Confirm",
      client_context: { timezone: "Asia/Kolkata", current_path: "/whatsapp" },
    });
    session.lastSnapshot = turn.case_snapshot || null;
    return turn.assistant_message?.content_redacted ?? "Confirmed.";
  }

  const location = snapshot.location || {
    state: "Karnataka",
    district: "Bengaluru Urban",
    pincode: "560001",
  };

  const confirmResp = await apiPost(
    `/intake/chat/${session.conversationId}/confirm`,
    {
      confirmed_snapshot: snapshot,
      location: location,
    }
  );

  // Reset confirmation state
  session.awaitingConfirm = false;
  session.lastSnapshot = null;

  // Build a WhatsApp-friendly response based on routing
  const pipeline = confirmResp.routing?.pipeline;
  const complaintId = confirmResp.complaint?.id || "N/A";
  const amount = snapshot.amount || snapshot.facts?.amount || 0;
  const fraudType = snapshot.fraud_type || "unknown";
  const upiId = snapshot.facts?.upi_id || "";
  const utr = snapshot.facts?.utr || "";
  const docs = confirmResp.documents || [];

  if (pipeline === "golden_hour") {
    let msg = "🚨 *EMERGENCY — GOLDEN HOUR ACTIVE*\n\n";
    msg += "📞 Call *1930* NOW. This is India's national cybercrime helpline.\n\n";
    msg += `*Case:* ${complaintId}\n`;
    msg += `*Amount:* Rs ${amount}\n`;
    msg += `*Type:* ${fraudType}\n`;
    if (upiId) msg += `*UPI ID:* ${upiId}\n`;
    if (utr) msg += `*UTR:* ${utr}\n`;
    msg += "\nTell the 1930 operator:\n";
    msg += "• Amount lost and when\n";
    msg += "• UTR number\n";
    msg += "• Scammer's UPI ID / phone\n";
    msg += "• Your bank name\n\n";
    msg += "⏱️ The first 60 minutes are critical for freezing funds.\n\n";
    msg += "After calling 1930, file at: cybercrime.gov.in";
    return msg;
  }

  if (pipeline === "post_golden_hour") {
    let msg = "✅ *Case Confirmed — " + complaintId + "*\n\n";
    msg += "Your complaint package is ready. Here's what to do:\n\n";
    msg += "1️⃣ File at *cybercrime.gov.in* (National Cyber Crime Reporting Portal)\n";
    msg += "2️⃣ Contact your bank — dispute the transaction with this complaint ID\n";
    msg += "3️⃣ Visit your local police station if the amount is significant\n\n";
    if (docs.length > 0) {
      msg += "📄 *Documents generated:*\n";
      for (const doc of docs) {
        msg += `• ${doc.title || doc.kind || "Document"}\n`;
      }
    }
    msg += `\nSave your case ID: \`${complaintId}\``;
    return msg;
  }

  // Fall-back / general
  let msg = "✅ *Case Confirmed — " + complaintId + "*\n\n";
  msg += "Your report has been recorded. Here's what to do next:\n\n";
  msg += "1️⃣ File an online complaint at *cybercrime.gov.in*\n";
  msg += "2️⃣ Contact your bank to flag the transaction\n";
  msg += `3️⃣ Save your case ID: \`${complaintId}\`\n\n`;
  msg += "If you feel unsafe or the scam is ongoing, contact your local police.";
  return msg;
}

// ─── Image message handler ──────────────────────────────────────────────────

async function handleImageMessage(phone, imageMsg, sock, msg) {
  const existing = sessions.get(phone);
  const { downloadMediaMessage } = require("@whiskeysockets/baileys");

  let imageBuffer;
  try {
    imageBuffer = await downloadMediaMessage(msg, "buffer", {});
  } catch (e) {
    console.error("  ✗ Image download failed:", e.message);
    return "❌ Couldn't download that image. Can you describe what happened in text?";
  }

  const imageBase64 = imageBuffer.toString("base64");

  if (!existing) {
    const start = await apiPost("/intake/chat/start", {
      preferred_language: "en",
      contact_channel: "whatsapp",
    });
    sessions.set(phone, {
      sessionId: start.session_id,
      conversationId: start.conversation_id,
      lastSnapshot: start.case_snapshot || null,
      awaitingConfirm: false,
    });

    const turn = await apiPost(`/intake/chat/${start.conversation_id}/turn`, {
      message: "[Screenshot received]",
      image_base64: imageBase64,
      client_context: { timezone: "Asia/Kolkata", current_path: "/whatsapp" },
    });

    const s = sessions.get(phone);
    s.lastSnapshot = turn.case_snapshot || null;
    s.awaitingConfirm = turn.case_snapshot?.next_action === "confirm_facts";

    return turn.assistant_message?.content_redacted ?? "I've received your image.";
  }

  const turn = await apiPost(`/intake/chat/${existing.conversationId}/turn`, {
    message: "[Screenshot received]",
    image_base64: imageBase64,
    client_context: { timezone: "Asia/Kolkata", current_path: "/whatsapp" },
  });

  existing.lastSnapshot = turn.case_snapshot || null;
  existing.awaitingConfirm = turn.case_snapshot?.next_action === "confirm_facts";

  return turn.assistant_message?.content_redacted ?? "I've received your image.";
}

module.exports = { handleTextMessage, handleImageMessage, sessions };
