# WhatsApp Gateway — Baileys Sidecar for CyberSaathi Intake

Thin Node.js transport layer that forwards WhatsApp messages into the existing
FastAPI intake pipeline (`/intake/chat/start`, `/intake/chat/{id}/turn`,
`/intake/chat/{id}/confirm`). All LLM logic stays in Python — this is just a
pipe.

## When to use Baileys vs Official API

| | Official Cloud API | Baileys (unofficial) |
|---|---|---|
| Setup time | 1-5 business days (Meta verification) | 5 minutes (QR scan) |
| Approval needed | Business Manager, phone verification | None |
| Per-message cost | Free (reactive, 24h window) / ₹0.12+ (proactive) | Zero |
| Ban risk | Near zero if compliant | High — typically 2-8 weeks before detection |
| Best for | Production, reliability matters | **Hackathons, demos, prototyping** |
| Template restrictions | Pre-approved templates required for outbound | None — send anything |

**Rule:** hackathon/demo → Baileys (setup in minutes, ban won't hit before
judging). Production/victim-facing → official Cloud API only.

## Architecture

```
WhatsApp → Baileys WebSocket (index.js)
    → bridge.js
        → POST /intake/chat/start       (first contact per phone number)
        → POST /intake/chat/{id}/turn   (subsequent messages)
        → POST /intake/chat/{id}/confirm (fact confirmation)
    → existing FastAPI LLM orchestrator
    → response text ← bridge.js ← Baileys ← WhatsApp
```

### Session tracking

In-memory `Map<phoneNumber, { sessionId, conversationId }>` in `bridge.js`.
Lost on gateway restart — acceptable for demos. For production, persist to
a database or use the victim session lookup already in FastAPI.

### Message flow

1. Victim messages the WhatsApp number
2. `index.js` receives via `messages.upsert` event, extracts phone and text
3. If first contact: `bridge.js` calls `POST /intake/chat/start` → stores
   `conversationId` keyed by phone → returns welcome message to WhatsApp
4. If returning: calls `POST /intake/chat/{id}/turn` with the message text →
   returns assistant response from LLM pipeline
5. If image: downloads media via Baileys, converts to base64, sends to
   `/intake/chat/{id}/turn` with `image_base64` field → vision model processes

### Rate limiting

Outgoing messages are queued with 800ms + random(0-1200ms) delay between each.
This prevents WhatsApp's velocity detection from flagging the account as a bot.
`queueReply()` in `index.js` handles this.

## Files

```
apps/whatsapp-gateway/
├── index.js       # WebSocket connection, QR code, message routing, rate queue
├── bridge.js      # HTTP client → FastAPI intake endpoints, session store
├── package.json   # @whiskeysockets/baileys v7, pino, qrcode-terminal
├── .env.example   # CYBERSAATHI_API_URL=http://127.0.0.1:8000
└── .gitignore     # node_modules/, auth_info_baileys/, .env
```

## Running

```bash
# Terminal 1 — FastAPI (must be up first)
cd apps/api
docker compose up -d postgres
PYTHONPATH=.:../.. uv run python run_api.py

# Terminal 2 — WhatsApp gateway
cd apps/whatsapp-gateway
npm start
# → QR code appears in terminal
# → WhatsApp → Settings → Linked Devices → Link a Device → scan QR
# → Wait for "✅ WhatsApp connected — CyberSaathi is live on WhatsApp!"
```

Now message that number from another phone. The welcome prompt from
`/intake/chat/start` fires automatically.

## Pitfalls

- **Postgres must be running.** The intake endpoints need the database.
  Without it, `/intake/chat/start` returns 503.
- **Gateway must restart if API restarts.** The in-memory session map is lost.
  First message after restart creates a fresh session.
- **Auth state persists.** `auth_info_baileys/` stores the session. Don't
  delete it unless you want to re-pair. Delete it if you get logged out
  (`logged_out` disconnect reason).
- **Only one instance.** Baileys can't run in cluster mode (PM2 instances=1).
  Running multiple instances on the same number causes auth conflicts.
- **Group messages are skipped.** `jid.endsWith("@g.us")` is filtered out.
  Only 1:1 chats reach the intake pipeline.
- **Image downloads can fail.** WhatsApp's media servers sometimes reject.
  The handler returns a fallback message asking the victim to describe in text.
- **Rate limit: 30-60 msg/hour safe zone.** Above 60/hour + low reply ratio
  triggers detection. For demos with <100 messages total, this is irrelevant.
