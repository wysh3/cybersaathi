/**
 * CyberSaathi WhatsApp Gateway — index.js
 *
 * Baileys-based WhatsApp WebSocket gateway for hackathon demo.
 * Scans QR code once, then forwards all incoming WhatsApp messages
 * to the CyberSaathi FastAPI intake pipeline.
 *
 * Usage:
 *   npm start
 *   # Scan QR code from terminal
 *   # Send a WhatsApp message to the connected number
 *
 * Requirements:
 *   - CyberSaathi API running at CYBERSAATHI_API_URL (default http://127.0.0.1:8000)
 *   - PostgreSQL running (the intake endpoints need the DB)
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const qrcodeTerminal = require("qrcode-terminal");
const { handleTextMessage, handleImageMessage } = require("./bridge");

// ─── Config ────────────────────────────────────────────────────────────────
const AUTH_DIR = "auth_info_baileys";
const API_URL = process.env.CYBERSAATHI_API_URL || "http://127.0.0.1:8000";

// ─── Logging ───────────────────────────────────────────────────────────────
const logger = pino({ level: "info" });

// ─── Rate-limited message queue ────────────────────────────────────────────
// WhatsApp bans accounts that send messages too fast. This queue spaces
// outgoing messages by at least 800ms to look human.
const msgQueue = [];
let queueRunning = false;

async function processQueue() {
  if (queueRunning) return;
  queueRunning = true;
  while (msgQueue.length > 0) {
    const { sock, jid, text } = msgQueue.shift();
    try {
      await sock.sendMessage(jid, { text });
      logger.info({ jid }, "Sent reply");
    } catch (e) {
      logger.error({ jid, error: e.message }, "Send failed");
    }
    // Human-like delay between messages
    await sleep(800 + Math.random() * 1200);
  }
  queueRunning = false;
}

function queueReply(sock, jid, text) {
  msgQueue.push({ sock, jid, text });
  processQueue();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── WhatsApp Connection ───────────────────────────────────────────────────
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
    // Natural typing indicator delay
    defaultQueryTimeoutMs: undefined,
  });

  // ── Connection lifecycle ─────────────────────────────────────────────
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n╔══════════════════════════════════════════════════════╗");
      console.log("║     CyberSaathi WhatsApp Gateway — Scan QR Code     ║");
      console.log("║   Open WhatsApp → Settings → Linked Devices → Scan  ║");
      console.log("╚══════════════════════════════════════════════════════╝\n");
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
          : true;

      if (shouldReconnect) {
        logger.warn("Connection closed — reconnecting in 3s...");
        await sleep(3000);
        connectToWhatsApp();
      } else {
        logger.error("Logged out. Delete auth_info_baileys/ and restart to re-pair.");
      }
    } else if (connection === "open") {
      logger.info("✅ WhatsApp connected — CyberSaathi is live on WhatsApp!");
      logger.info(`   API backend: ${API_URL}`);
    }
  });

  // ── Credential persistence ───────────────────────────────────────────
  sock.ev.on("creds.update", saveCreds);

  // ── Incoming message handler ─────────────────────────────────────────
  sock.ev.on("messages.upsert", async (m) => {
    if (m.type !== "notify") return;

    for (const msg of m.messages) {
      // Skip outgoing messages and group chats
      if (msg.key.fromMe) continue;
      const jid = msg.key.remoteJid;
      if (!jid || jid.endsWith("@g.us")) continue;

      const phone = jid.replace("@s.whatsapp.net", "");
      const content = msg.message;

      // Extract text from all possible payload shapes
      const textBody =
        content?.conversation ||
        content?.extendedTextMessage?.text ||
        "";

      const imageMsg = content?.imageMessage;

      logger.info({ phone, hasText: !!textBody, hasImage: !!imageMsg }, "Incoming");

      try {
        let replyText;

        if (imageMsg) {
          // ── Image message → vision pipeline ─────────────────────
          queueReply(sock, jid, "📸 Received your image. Analyzing...");
          replyText = await handleImageMessage(phone, imageMsg, sock, msg);
        } else if (textBody.trim()) {
          // ── Text message → intake pipeline ─────────────────────
          replyText = await handleTextMessage(phone, textBody.trim());
        } else {
          // Sticker, audio, etc. — ignore for now
          continue;
        }

        queueReply(sock, jid, replyText);
      } catch (err) {
        logger.error({ phone, error: err.message }, "Handler error");
        queueReply(
          sock,
          jid,
          "⚠️ I ran into an issue processing that. Please try again or describe what happened differently."
        );
      }
    }
  });

  return sock;
}

// ─── Startup ───────────────────────────────────────────────────────────────
async function main() {
  console.log("┌─────────────────────────────────────────────────────┐");
  console.log("│       CyberSaathi WhatsApp Gateway (Hackathon)      │");
  console.log("│       Baileys + FastAPI intake pipeline             │");
  console.log("│       API: " + API_URL.padEnd(33) + " │");
  console.log("└─────────────────────────────────────────────────────┘\n");

  // Quick health check on the API
  try {
    const res = await fetch(`${API_URL}/health`);
    if (res.ok) {
      logger.info("API health check: ✅ reachable");
    } else {
      logger.warn(`API health check: returned ${res.status}`);
    }
  } catch {
    logger.warn("API health check: ❌ unreachable — is the FastAPI server running?");
    logger.warn(`  Expected at: ${API_URL}`);
    logger.warn("  Start with: cd apps/api && PYTHONPATH=.:../.. uv run python run_api.py\n");
  }

  await connectToWhatsApp();
}

main().catch((err) => {
  logger.fatal({ error: err.message }, "Gateway crashed");
  process.exit(1);
});
