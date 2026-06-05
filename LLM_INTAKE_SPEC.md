# CyberSaathi LLM Intake Implementation Spec

Date: 2026-06-05
Status: handoff spec, not yet implemented
Target model: `nvidia/nemotron-3-nano-30b-a3b` through NVIDIA NIM / build.nvidia.com

## 1. Goal

Turn the home intake surface from a deterministic report-builder form into a real, safe, persisted conversational case builder.

A victim should be able to arrive at `/`, describe what happened in natural language, answer short follow-up questions, paste SMS/chat evidence, and have CyberSaathi:

1. Maintain a conversation tied to a `VictimSession`.
2. Extract structured facts from the dialogue and evidence.
3. Ask only for missing critical facts.
4. Redact sensitive values before storing or showing them.
5. Persist complaint/evidence/identifiers/documents to Postgres when `DATABASE_ENABLED=true`.
6. Keep deterministic routing as the authority for Golden Hour, Post-Golden-Hour, and Fall-Back transitions.
7. Generate user-facing next steps without promising recovery or pretending to submit official reports.

This is not a generic chatbot. The LLM is an intake co-pilot and structured case-state updater. Deterministic CyberSaathi services remain the source of truth for routing, redaction, recovery bands, similarity counts, document generation, and simulated integrations.

## 2. Current Code Reality

### Frontend

- Home page is `apps/web/app/page.tsx`; it renders `IntakeComposer`.
- Main intake UI is `apps/web/components/intake/IntakeComposer.tsx`.
- The component currently:
  - starts a session with `useWorkflowStore.ensureSession()`.
  - captures `description`, pasted evidence, amount, minutes ago, and payment method.
  - calls `api.classify(sessionId, payload)`.
  - stores routing and extracted facts in Zustand.
  - navigates to `/emergency`, `/documents`, or `/fall-back`.
- It does not create a complaint record after classification.
- The screenshot mode only reads text files with `file.text()`. Real OCR is still a stub.
- The voice mode is explicitly a stub.
- API client is `apps/web/lib/api.ts`; all calls go directly to FastAPI through `NEXT_PUBLIC_API_BASE_URL`, defaulting to `http://127.0.0.1:8000`.
- Workflow state is `apps/web/lib/workflow-store.ts`; it is intentionally light and re-fetches durable data by complaint id.

### Backend

- FastAPI entry point is `apps/api/app/main.py`.
- `/intake/session` and `/intake/classify` live in `apps/api/app/routers/intake.py`.
- `apps/api/app/services/intake.py` currently has:
  - an in-memory `_sessions` dict.
  - `process_intake()`, which calls deterministic routing, regex extraction, and redaction.
  - `record_complaint()`, which persists a complaint/evidence/identifiers through `get_seed_store()`.
- `apps/api/app/services/routing.py` is deterministic and must remain authoritative for pipeline routing.
- `apps/api/app/services/extraction.py` is deterministic regex OCR/NER style extraction.
- `apps/api/app/services/redaction.py` redacts Aadhaar, PAN, OTP, PIN, card, CVV, passwords, IFSC, and long account-like numbers.
- `/complaints` already creates a complaint when the frontend provides location, facts, pipeline, fraud type, and payment method.
- `/complaints/{id}/documents`, `/recovery`, and `/similarity` already use persisted complaint/evidence data.
- `apps/api/app/models/db.py` has Postgres tables for complaints, scam identifiers, evidence, clusters, victim sessions, generated documents, and mock integration events.
- There is no table for conversation turns, LLM tool calls, case-state patches, prompt/version audit, or safety interventions.
- Postgres is activated through `DATABASE_ENABLED=true`; otherwise services fall back to in-memory seed store.

### External Repo Pattern To Reuse

The referenced repo `wysh3/multi-agent-clouddash` has useful implementation patterns:

- `config/providers.yaml`: provider abstraction with NVIDIA NIM as default.
- `providers/factory.py`: OpenAI-compatible `AsyncOpenAI` client pointed at `https://integrate.api.nvidia.com/v1`.
- `clouddash_agents/base.py`: NIM-specific fixups:
  - model `nvidia/nemotron-3-nano-30b-a3b`.
  - `extra_body={"chat_template_kwargs": {"enable_thinking": False}}`.
  - remove `reasoning_content` from history before sending messages back to NIM.
  - fallback to `reasoning_content` only if `message.content` is empty.
- `clouddash_agents/orchestrator.py`: orchestration with retries, trace ids, handover audit, and deterministic fallback when the model misses a handoff.
- `config/guardrails.yaml`: prompt-injection and PII guardrail config.
- `handover/context.py`: compact conversation summaries for downstream context.

Do not copy CloudDash domain logic. Reuse only provider abstraction, NIM quirks, config-driven prompts, guardrail style, trace ids, and tests.

## 3. Product Constraints

Hard constraints from `AGENTS.md`:

- First screen remains emergency intake, not a marketing page.
- No registration before intake.
- Do not ask the user to choose a fraud category first.
- Do not call real government, police, bank, WhatsApp, RTI, NCRP, or payment services.
- Do not guarantee recovery.
- Do not store Aadhaar, PAN, OTPs, passwords, PINs, full card numbers, CVV, or financial credentials.
- Red emergency UI remains only for Golden Hour.
- Similarity, heatmap, and accountability stats must come from seeded or persisted records, not LLM invention.
- LLM output can recommend the next CyberSaathi action, but deterministic services must decide and persist the actual workflow state.

## 4. Recommended Architecture

Add a backend module called `app/services/llm_intake/` with these boundaries:

```text
Frontend Chat UI
  -> POST /intake/chat/start
  -> POST /intake/chat/{conversation_id}/turn
  -> GET  /intake/chat/{conversation_id}

FastAPI chat router
  -> LlmIntakeOrchestrator
     -> NIM client
     -> prompt registry
     -> safety guardrails
     -> deterministic extraction/redaction/routing
     -> case-state reducer
     -> complaint/evidence/document services
     -> conversation repository

Postgres
  -> victim_sessions
  -> intake_conversations
  -> intake_messages
  -> intake_case_snapshots
  -> llm_invocations
  -> existing complaints/evidence/identifiers/documents
```

The LLM should not directly write the database. It should produce a typed `CaseStatePatch` and a user-facing response. The orchestrator validates the patch with Pydantic, redacts unsafe values, merges it into the current case snapshot, runs deterministic extraction/routing, then performs allowed actions.

## 5. Data Model Additions

Add Pydantic models in `apps/api/app/models/llm_intake.py` or the existing models package. Add SQLAlchemy ORM classes and an Alembic migration.

### IntakeConversation

Fields:

- `id`: `conv-...`
- `victim_session_id`
- `complaint_id`: nullable until complaint is created
- `status`: `active | ready_to_route | routed | completed | abandoned | blocked`
- `current_phase`: `describe | clarify | confirm | route | documents`
- `created_at`
- `updated_at`
- `last_model`: nullable
- `safety_flags`: JSON list
- `case_snapshot`: JSON object, latest canonical state

### IntakeMessage

Fields:

- `id`: `msg-...`
- `conversation_id`
- `role`: `user | assistant | system | tool`
- `content_redacted`
- `content_original`: nullable; only store if safe, otherwise null
- `message_kind`: `chat | evidence | question | action | error`
- `metadata`: JSON object
- `created_at`

### LlmInvocation

Fields:

- `id`: `llm-...`
- `conversation_id`
- `provider`: `nvidia_nim`
- `model`: `nvidia/nemotron-3-nano-30b-a3b`
- `prompt_version`
- `input_summary_redacted`
- `output_summary_redacted`
- `raw_output_redacted`: optional for debug, never store secrets
- `latency_ms`
- `status`: `success | retry | fallback | failed | blocked`
- `error_type`: nullable
- `token_usage`: JSON object
- `created_at`

### CaseStateSnapshot JSON Shape

```json
{
  "language": "en",
  "user_distress": "low|medium|high",
  "incident_summary": "",
  "fraud_type": "upi_fraud|banking_fraud|wallet_fraud|online_payment_fraud|sextortion|job_scam|account_hack|harassment|phishing|other|unknown",
  "payment_method": "upi|card|netbanking|wallet|cash|none|auto|unknown",
  "amount": null,
  "incident_at": null,
  "location": {
    "state": null,
    "district": null,
    "pincode": null
  },
  "facts": {
    "utr": null,
    "upi_id": null,
    "amount": null,
    "timestamp": null,
    "bank": null,
    "payment_app": null,
    "phone": null,
    "handle": null,
    "url": null,
    "name_mentions": []
  },
  "evidence_texts": [],
  "missing_required_fields": [],
  "routing": null,
  "complaint_id": null,
  "generated_document_ids": [],
  "safety_flags": [],
  "next_action": "ask_followup|confirm_facts|create_complaint|route_golden_hour|route_documents|route_fall_back"
}
```

## 6. API Contract

Add a new router `apps/api/app/routers/intake_chat.py`.

### POST `/intake/chat/start`

Request:

```json
{
  "preferred_language": "en",
  "contact_channel": "web"
}
```

Response:

```json
{
  "session_id": "vs-...",
  "conversation_id": "conv-...",
  "message": {
    "role": "assistant",
    "content": "Tell me what happened. You can write normally or paste the bank/SMS alert."
  },
  "case_snapshot": {},
  "status": "active"
}
```

### POST `/intake/chat/{conversation_id}/turn`

Request:

```json
{
  "message": "I paid 2500 by GPay 15 minutes ago...",
  "evidence_text": "optional pasted SMS/chat text",
  "client_context": {
    "timezone": "Asia/Kolkata",
    "current_path": "/",
    "location": null
  }
}
```

Response:

```json
{
  "conversation_id": "conv-...",
  "session_id": "vs-...",
  "assistant_message": {
    "role": "assistant",
    "content": "I found this looks like UPI fraud inside the 60 minute window. Please confirm these details..."
  },
  "case_snapshot": {},
  "routing": {
    "pipeline": "golden_hour",
    "confidence": 0.9,
    "reasoning": [],
    "golden_hour_remaining_seconds": 2700,
    "is_financial": true
  },
  "complaint": null,
  "documents": [],
  "ui_actions": [
    { "type": "show_fact_review" },
    { "type": "enable_continue", "target": "/emergency" }
  ],
  "safety_flags": []
}
```

### POST `/intake/chat/{conversation_id}/confirm`

The frontend calls this when the user accepts the extracted facts. The backend creates or updates the complaint, persists evidence and identifiers, generates documents if needed, and returns route actions.

Request:

```json
{
  "confirmed_snapshot": {},
  "location": {
    "state": "Karnataka",
    "district": "Bengaluru Urban",
    "pincode": "560001"
  }
}
```

Response includes `complaint`, `documents`, `routing`, `similarity`, and `ui_actions`.

## 7. LLM Provider Layer

Add `apps/api/app/services/llm/provider.py`.

Requirements:

- Use `openai.AsyncOpenAI`, because NVIDIA NIM is OpenAI-compatible.
- Add dependencies to `apps/api/pyproject.toml`: `openai`, `pyyaml`, optionally `tenacity`.
- Env vars:
  - `LLM_PROVIDER=nvidia_nim`
  - `NVIDIA_API_KEY=...`
  - `LLM_MODEL_INTAKE=nvidia/nemotron-3-nano-30b-a3b`
  - `LLM_ENABLED=true`
  - `LLM_TIMEOUT_SECONDS=25`
  - `LLM_MAX_RETRIES=2`
- Default provider config:

```yaml
providers:
  default: nvidia_nim
  nvidia_nim:
    base_url: https://integrate.api.nvidia.com/v1
    api_key_env: NVIDIA_API_KEY
    models:
      intake: nvidia/nemotron-3-nano-30b-a3b
```

Every NIM chat completion call must include:

```python
extra_body={"chat_template_kwargs": {"enable_thinking": False}}
temperature=0.1
max_tokens=1200
```

Before sending history back to NIM:

- Remove `reasoning_content` from assistant messages.
- Keep only the last 8 to 12 redacted messages plus the latest case summary.
- Do not send raw Aadhaar/PAN/OTP/password/PIN/card values.

If `message.content` is empty, inspect `message.reasoning_content` as a fallback, redact it, and treat that as visible output only if it does not contain chain-of-thought style private reasoning. Prefer asking a deterministic fallback question over showing questionable output.

## 8. Prompt Engineering Contract

Add prompt files under `apps/api/app/services/llm_intake/prompts/`.

### `system.md`

Core rules:

- You are CyberSaathi's emergency intake co-pilot for Indian cybercrime victims.
- Your job is to collect facts, reduce panic, and update structured case state.
- You are not police, bank, NCRP, 1930, RTI, or WhatsApp.
- Never say a report was submitted or a call was made.
- Never guarantee recovery.
- Never ask for OTP, PIN, password, CVV, full card number, Aadhaar, PAN, or bank credentials.
- If the user provides those values, acknowledge that sensitive values were redacted and continue with safer fields.
- Ask one short follow-up question at a time unless facts are ready for confirmation.
- For fresh financial fraud, prioritize time, amount, payment method, UTR/reference, receiver UPI/account/phone, bank/app.
- For sextortion/harassment, be non-judgmental, do not advise payment, prioritize safety and evidence preservation.
- Output must be valid JSON only, matching the response schema.

### `developer_context.md`

Include:

- Current AGENTS product constraints.
- Routing policy summary.
- Missing-field priorities.
- Document generation and official-integration limits.
- Language/tone rules.

### JSON Output Schema

The model must output:

```json
{
  "assistant_message": "string shown to user",
  "case_patch": {
    "incident_summary": null,
    "fraud_type": null,
    "payment_method": null,
    "amount": null,
    "incident_at": null,
    "user_distress": null,
    "facts": {},
    "location": {},
    "evidence_texts_to_add": []
  },
  "missing_fields": [],
  "next_action": "ask_followup|confirm_facts|create_complaint|route_now|fallback_to_deterministic",
  "confidence": 0.0,
  "safety_flags": [],
  "questions": [
    {
      "id": "incident_time",
      "prompt": "About how many minutes or hours ago did the payment happen?",
      "reason": "Needed to decide whether to show the 1930 Golden Hour flow."
    }
  ]
}
```

The backend validates this with Pydantic. Invalid JSON triggers a repair prompt once; if repair fails, use deterministic extraction and ask a fixed follow-up question.

## 9. Context Engineering

Do not send the full database or raw seed data to the LLM.

For each turn, build a compact context packet:

```text
Current phase: clarify
Current redacted case summary: ...
Known facts: amount=2500, payment_method=upi, incident_at=...
Missing critical facts: location.district, receiver identifier
Deterministic routing so far: golden_hour, confidence 0.85
Safety flags: none
Last 6 messages, redacted:
...
Allowed actions this turn:
- ask_followup
- confirm_facts
- fallback_to_deterministic
```

Context sources:

- Last 6 to 10 redacted conversation messages.
- Latest `case_snapshot`.
- Deterministic `extract_facts()` output from the latest user input and evidence.
- Deterministic `route_intake()` result from the merged snapshot.
- Optional similarity summary only after a complaint exists.
- Current date/time from server, timezone from client if supplied.

The LLM can suggest a route, but the orchestrator must run `route_intake()` again after merging the patch.

## 10. Tool/Skill Layer

Implement "skills" as deterministic Python functions the orchestrator can call, not as model-executed arbitrary code.

Initial skills:

- `redact_user_input(text) -> RedactionResult`
- `extract_evidence_facts(description, evidence_text, hints) -> ExtractedFacts`
- `route_case(snapshot) -> RoutingDecision`
- `create_or_update_complaint(snapshot, session_id) -> ComplaintRecord`
- `generate_document_package(complaint_id) -> GeneratedDocumentsResponse`
- `get_similarity(complaint_id) -> SimilarityResult`
- `prepare_helpline_call(complaint_id) -> MockIntegrationEvent`
- `log_training_candidate(conversation_id, reason)`

The model only emits intent: `next_action` and `case_patch`. The orchestrator decides which skill runs.

## 11. Safety Guardrails

Input guardrails:

- Detect prompt injection phrases like "ignore previous instructions", "system prompt", "pretend you are", "jailbreak".
- Do not block victims automatically for injection-like text in pasted scam messages; flag and continue with strict system prompt.
- Redact sensitive values before persistence and before sending context to NIM.
- If self-harm terms appear, respond supportively and include immediate safety guidance. Still route cybercrime facts if present.

Output guardrails:

- Reject output if it says or implies:
  - "I filed/submitted/called."
  - "Your money will be recovered."
  - "Share OTP/PIN/password/CVV/card details."
  - "Pay the scammer."
  - invented statistics, FIR counts, or recovery odds.
- Run all assistant text through a policy checker before saving.
- If output fails, replace with a deterministic safe message and log `LlmInvocation.status="blocked"`.

## 12. Frontend Plan

Replace or wrap `IntakeComposer` with a split conversational case builder:

- Left/main: chat timeline plus message box.
- Evidence affordances remain: write, paste SMS/chat, screenshot text upload, voice stub.
- Right/aside after first meaningful turn: live case facts, missing fields, routing preview, privacy notice.
- Keep "What happened?" as the page title.
- Hide amount/minutes/payment form fields by default. They become editable extracted facts in a review panel.
- Add "Confirm and continue" only when backend returns `next_action=confirm_facts` or `route_now`.
- On confirm:
  - persist complaint through new chat confirm endpoint.
  - call `setComplaint`.
  - call `setRouting`.
  - navigate using backend `ui_actions`.
- Keep demo scenario chips, but make them send messages into the chat instead of filling legacy form fields.

New TS types in `apps/web/lib/types/index.ts`:

- `IntakeChatStartResponse`
- `IntakeChatTurnRequest`
- `IntakeChatTurnResponse`
- `CaseStateSnapshot`
- `UiAction`
- `ChatMessage`

New API methods in `apps/web/lib/api.ts`:

- `startIntakeChat()`
- `sendIntakeChatTurn(conversationId, body)`
- `confirmIntakeChat(conversationId, body)`
- `getIntakeChat(conversationId)`

State additions in `workflow-store.ts`:

- `conversationId`
- `caseSnapshot`
- `chatMessages`
- `setConversation`
- `appendChatMessages`
- `setCaseSnapshot`

## 13. Backend Implementation Phases

### Phase 1: Durable Conversation Backbone

- Add Pydantic models and ORM tables.
- Add repository methods for conversations/messages/invocations.
- Persist `/intake/session` to `victim_sessions` when DB is enabled instead of only `_sessions`.
- Add `/intake/chat/start` and `/intake/chat/{id}`.
- No LLM yet; return deterministic welcome and empty snapshot.

### Phase 2: NIM Provider and Structured Turn

- Add provider config and `AsyncOpenAI` client.
- Add system/developer prompts.
- Add `LlmIntakeOrchestrator.process_turn()`.
- Validate model JSON output.
- Add retry/repair/fallback path.
- Save `LlmInvocation`.
- Return assistant message and case snapshot.

### Phase 3: Deterministic Reducer and Persistence

- Merge model patch with deterministic extraction.
- Run `route_intake()` after each turn.
- Derive missing fields.
- Add confirm endpoint.
- Create complaint through existing `record_complaint()`.
- Persist evidence from description plus pasted SMS/chat.
- Generate documents when route is Post-Golden-Hour or after Golden Hour reference capture.

### Phase 4: Frontend Chat Intake

- Replace legacy form submit with chat turn calls.
- Add live fact review.
- Add confirm flow.
- Preserve mobile layout and bottom nav spacing.
- Keep old `api.classify` behind a fallback path until tests pass.

### Phase 5: QA, Prompt Evals, and Demo Hardening

- Add prompt eval fixtures for:
  - Priya UPI fraud 15 minutes ago.
  - Financial fraud 6 hours ago.
  - Sextortion plus UPI demand.
  - Job scam with multiple payments.
  - Account hack with money unclear.
  - Prompt injection in pasted scam text.
  - User includes OTP/PIN/card/PAN/Aadhaar.
- Add tests for DB persistence, redaction, routing, document generation, and UI navigation.
- Add NIM-disabled fallback tests with `LLM_ENABLED=false`.

## 14. Acceptance Criteria

Backend:

- With `DATABASE_ENABLED=true`, a complete chat intake creates:
  - `victim_sessions` row.
  - `intake_conversations` row.
  - redacted `intake_messages`.
  - `llm_invocations`.
  - `complaints`, `evidence_items`, `scam_identifiers`.
  - generated documents after confirmation.
- With `LLM_ENABLED=false`, intake still works through deterministic extraction/routing.
- No sensitive values are stored in message content, evidence redacted text, LLM context, or invocation logs.
- Deterministic routing wins over model output when they conflict.
- LLM cannot produce official-submission claims or recovery guarantees.

Frontend:

- First screen remains `/` and asks "What happened?"
- User can chat naturally and paste SMS/chat evidence.
- Extracted facts update on the page.
- User can confirm facts and continue to the correct route.
- Golden Hour route shows `/emergency` with complaint id hydrated.
- Post-Golden-Hour route shows `/documents` with generated package.
- Fall-Back route still works for unclear/high-distress cases.
- Mobile layout has no bottom-nav overlap.

Performance:

- First LLM turn target: <= 8 seconds on normal network.
- Deterministic fallback target: <= 3 seconds.
- NIM timeout should return a safe fallback message rather than a blank UI.

## 15. Test Plan

Backend commands:

```bash
cd apps/api
PYTHONPATH=apps/api:../.. uv run pytest
```

Frontend commands:

```bash
cd apps/web
npm run typecheck
npm run lint
npm run build
npx tsx tests/browser-smoke.ts
npx tsx tests/e2e-priya.ts
npx tsx tests/e2e-fall-back.ts
npx tsx tests/e2e-golden-hour-bilingual.ts
```

New backend tests:

- `test_llm_provider_nim_settings.py`
- `test_intake_chat_redaction.py`
- `test_intake_chat_case_reducer.py`
- `test_intake_chat_confirm_persistence.py`
- `test_intake_chat_guardrails.py`
- `test_intake_chat_llm_disabled_fallback.py`

New frontend tests:

- `tests/e2e-llm-intake-priya.ts`
- `tests/e2e-llm-intake-post-golden-hour.ts`
- `tests/e2e-llm-intake-sensitive-redaction.ts`

## 16. Risks and Decisions

Recommended decisions:

- Use direct OpenAI-compatible `AsyncOpenAI` calls first, not the OpenAI Agents SDK. The product needs strict typed JSON and deterministic side effects more than multi-agent handoff machinery.
- Keep all official actions as CyberSaathi mock adapters.
- Keep routing deterministic.
- Keep conversation storage in Postgres, not files.
- Use LLM for natural-language understanding and supportive copy, not for facts that existing deterministic services can compute.

Risks:

- NIM can return empty content unless thinking is disabled.
- Prompt-injection text may appear inside scam evidence; guardrails must flag, not blindly block.
- Raw evidence can contain sensitive values; redact before LLM context and storage.
- If the frontend confirms without location, current `/complaints` contract cannot create a complaint. The new confirm endpoint should either require district/state or default to a clearly marked demo location only for scripted scenarios.
- Existing `record_complaint()` stores `original_text=description`; update it or wrap it so sensitive text is never persisted raw.

## 17. File Checklist For The Implementing Agent

Likely backend files:

- `apps/api/pyproject.toml`
- `apps/api/app/main.py`
- `apps/api/app/models/__init__.py`
- `apps/api/app/models/db.py`
- `apps/api/app/routers/intake_chat.py`
- `apps/api/app/services/llm/provider.py`
- `apps/api/app/services/llm_intake/orchestrator.py`
- `apps/api/app/services/llm_intake/prompts/*.md`
- `apps/api/app/services/llm_intake/reducer.py`
- `apps/api/app/services/llm_intake/guardrails.py`
- `apps/api/app/services/repositories/*.py`
- `apps/api/app/alembic/versions/*.py`
- `apps/api/app/tests/*.py`

Likely frontend files:

- `apps/web/components/intake/IntakeComposer.tsx`
- `apps/web/components/intake/ChatIntakeComposer.tsx`
- `apps/web/components/intake/CaseFactReview.tsx`
- `apps/web/lib/api.ts`
- `apps/web/lib/types/index.ts`
- `apps/web/lib/workflow-store.ts`
- `apps/web/tests/*.ts`

Before frontend edits, read the relevant installed Next.js docs under `apps/web/node_modules/next/dist/docs/` as required by `AGENTS.md`.

