# LLM Intake Chat Backend — Pipeline & Pitfalls

Covers `apps/api/app/services/llm_intake/` and `apps/api/app/routers/intake_chat.py`.

## Architecture

```
User message → chat_turn() [router]
  → _build_snapshot_from_conv()       # Load existing case state from DB
  → LlmIntakeOrchestrator.process_turn()
      → extract_facts()               # Deterministic regex extraction (original text)
      → route_intake()                # Deterministic routing
      → _enrich_snapshot_with_det_facts()  # Merge det facts into snapshot BEFORE context
      → build_context_packet()        # Build LLM prompt context
      → chat_completion_json()        # Call NVIDIA NIM
      → reduce_case_state()           # Merge LLM patch + deterministic → final snapshot
  → _build_deterministic_message()    # Fallback message if LLM fails
  → Store + return to frontend
```

## Critical Pitfalls

### 1. Assistant message override (FIXED)
**Location:** `intake_chat.py` chat_turn() lines ~259-264

The old code threw away the LLM's `assistant_message` whenever the reducer's
`next_action` differed from the LLM's:
```python
# OLD — BROKEN
assistant_text = (
    _build_deterministic_message(snapshot)
    if snapshot.next_action != llm_output.next_action
    or snapshot.next_action == "confirm_facts"
    else llm_output.assistant_message
)
```

Since the reducer ALWAYS recomputes `next_action` from `_derive_missing()`,
it frequently disagrees with the LLM. Result: users saw "Which district are you
in?" instead of the LLM's warm, contextual message.

**Correct pattern:** Use the LLM's message when available. Only use deterministic
for `confirm_facts` (structured fact review is better UX).
```python
# FIXED
if snapshot.next_action == "confirm_facts":
    assistant_text = _build_confirm_message(snapshot)
elif llm_output.assistant_message and llm_output.assistant_message.strip():
    assistant_text = llm_output.assistant_message  # Trust the LLM
else:
    assistant_text = _build_deterministic_message(snapshot)
```

### 2. UTR redaction (FIXED)
**Location:** `redaction.py`

UTR numbers like `408722195166` (12 digits) matched the `\d{9,15}` account_long
redaction pattern and were replaced with `[REDACTED:ACCOUNT_LONG]`. UTRs are
transaction reference numbers — NOT account numbers — and are critical for
fraud tracking.

**Fix:** UTR preservation via placeholder swap:
1. Match UTR-prefixed numbers (`UTR 408722195166`, `txn ref ...`, etc.)
2. Replace with `__UTR_PRESERVED_{num}__` placeholder BEFORE redaction
3. Run all redaction patterns on the rest
4. Restore placeholders to original values AFTER redaction

This pattern (`_UTR_PRESERVE_RE` + `_UTR_PLACEHOLDER`) runs before account_long
in both `redact_text()` and `redact_text_keep_keywords()`.

### 3. Context packet built before deterministic facts merged (FIXED)
**Location:** `orchestrator.py` process_turn()

The old code built the context packet from `current_snapshot` BEFORE merging
deterministic extraction results. The LLM couldn't see already-extracted UTR,
amount, bank, payment app — so it asked redundant questions ("Can you share the
UTR?") when the UTR was already in the evidence.

**Fix:** `_enrich_snapshot_with_det_facts()` merges extracted facts into a copy
of the snapshot BEFORE `build_context_packet()` is called. The LLM sees all
extracted facts and focuses on genuinely missing information.

```python
enriched = _enrich_snapshot_with_det_facts(current_snapshot, det_facts, det_routing)
context = build_context_packet(snapshot=enriched, ...)
```

### 4. Multi-question guardrail (FIXED)
**Location:** `intake_chat.py` chat_turn()

The LLM occasionally returns two questions in one message despite the prompt
saying "EXACTLY ONE." This overwhelms panicking users.

**Fix:** Post-processing guardrail. If the LLM's `assistant_message` has >1
question mark, split on `\n\n` paragraph boundaries and keep only up through the
first paragraph containing a question mark.

```python
if assistant_text.count("?") > 1:
    paragraphs = assistant_text.split("\n\n")
    kept = []
    for para in paragraphs:
        kept.append(para)
        if "?" in para:
            break
    assistant_text = "\n\n".join(kept)
```

### 5. Duplicate `_derive_missing` with inconsistent logic (FIXED)
**Location:** `intake_chat.py:_derive_missing_fields()` vs `reducer.py:_derive_missing()`

The router version checked `snapshot.amount is None and snapshot.facts.amount is None`
(both must be null). The reducer version only checked `snapshot.amount is None`.
Fixed to match: both now check facts.amount too.

### 6. Deterministic fallback messages were robotic (FIXED)
**Location:** `intake_chat.py:_build_followup_message()`

Old: `"Which district are you in?"` (cold, no context)

New: `"Thank you. I can see this was UPI fraud, Rs 2,500. Which district are you in?"`
(warm, acknowledges what was found, asks one targeted question)

The updated `_build_followup_message()` builds a `found` list from the snapshot
and prefaces the question with context.

### 7. Redundant developer_context.md (REMOVED)
Both `system.md` and `developer_context.md` contained duplicate routing rules
and missing-field priorities. The model received the same info twice, confusing it.

Consolidated into `system.md` only. The `developer` role message was removed from
the orchestrator's message array.

### 8. max_tokens too low (FIXED)
**Location:** `orchestrator.py`

The old `max_tokens=1200` was insufficient for a full JSON response containing
`assistant_message` + `case_patch` with all facts + `questions` array. Truncation
caused malformed JSON and the repair path to trigger unnecessarily.

Bumped to `max_tokens=2000` for both primary and repair calls.

## Prompt Guidelines

The system prompt at `llm_intake/prompts/system.md` should:
- Say "ASK EXACTLY ONE follow-up question" (emphatic, not polite)
- Include "Before You Ask a Question: check what the user already told you"
- Use tone guidelines with good/bad examples
- Have NO literal example values in the JSON schema (models copy them verbatim)
- Be the ONLY prompt (no separate developer context)

## Vision Pipeline (Image Upload → LLM)

When the user attaches an image (screenshot of payment slip, bank SMS, etc.):

```
Image (base64) → chat_completion_vision() [nemotron-nano-12b-v2-vl]
  → extracted text → combined_evidence
  → extract_facts() + route_intake() on combined_evidence
  → _enrich_snapshot_with_det_facts() merges facts before context
  → LLM sees extracted text in context packet
  → router stores vision text as evidence message (source: "vision_model")
```

### Vision model config

`nvidia/nemotron-nano-12b-v2-vl` in `provider.py`:
```python
models:
  intake: nvidia/nemotron-3-nano-30b-a3b
  vision: nvidia/nemotron-nano-12b-v2-vl
```

Env override: `LLM_MODEL_VISION`

### chat_completion_vision()

Sends image as `data:image/png;base64,...` in OpenAI vision format:
```python
user_content = [
    {"type": "text", "text": extraction_prompt},
    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{base64}"}},
]
```

Uses a strict extraction prompt: "Extract ALL readable text. Return ONLY the
extracted text — no commentary, no analysis." temperature=0.1, max_tokens=800.

### Frontend integration

The Plus (+) button in ChatIntakeComposer triggers `<input type="file" accept="image/*">`.
`sendMessage()` reads file as base64, strips the data URI prefix, and sends
via `image_base64` field on `ChatTurnRequest`.

### Pitfall: UTR multi-line extraction from vision output

Vision models output text with line breaks. Example:
```
UTR number
408722195166
```

The original UTR regex (`_UTR_RE` in extraction.py) only matched same-line
patterns like `UTR 408722195166`. It missed the multi-line output. Fixed by
allowing `[\w\s:#=-]{0,30}[\n\r]\s*` between the UTR label and the digits.

**Same fix applied to both `extraction.py:_UTR_RE` and
`redaction.py:_UTR_PRESERVE_RE`.** Without this, the UTR is:
- In extraction: not detected → `facts.utr = None`
- In redaction: caught by `account_long` → `[REDACTED:ACCOUNT_LONG]`

### Test images

Two test images in `apps/web/public/`:
- `test-gpay-slip.png` — GPay receipt: Rs 2,500, scammer.fraud@upi, UTR 408722195166, SBI
- `test-bank-sms.png` — HDFC Bank SMS: Rs 8,000, Txn ID 719304825617

### End-to-end test command (Python)

```python
import base64, json, urllib.request

with open("/path/to/test-gpay-slip.png", "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode()

# Start conversation
resp = json.loads(urllib.request.urlopen(
    urllib.request.Request("http://127.0.0.1:8000/intake/chat/start",
        data=json.dumps({"preferred_language": "en"}).encode(),
        headers={"Content-Type": "application/json"}, method="POST"),
    timeout=10).read())
conv_id = resp["conversation_id"]

# Send image
payload = {"message": "I got this payment slip. Please check.", "image_base64": img_b64}
resp2 = json.loads(urllib.request.urlopen(
    urllib.request.Request(f"http://127.0.0.1:8000/intake/chat/{conv_id}/turn",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"}, method="POST"),
    timeout=120).read())

s = resp2["case_snapshot"]
assert s["amount"] == 2500.0
assert s["facts"]["upi_id"] == "scammer.fraud@upi"
assert s["facts"]["utr"] == "408722195166"  # Must be preserved, not redacted
assert s["routing"]["pipeline"] == "golden_hour"  # If message mentions time
```

## Testing Checklist

When changing the intake pipeline, test all four demo scenarios:
1. **Priya:** UPI fraud Rs 2,500, 15 min ago → Golden Hour, UTR preserved
2. **Sextortion:** Private video threat + UPI demand → Fall-back, 1 question
3. **Job scam:** Multiple payments over days → Post-golden-hour
4. **Account hack:** No financial loss → Post-golden-hour, 1 question

Verify each response:
- [ ] Exactly ONE question mark in the reply
- [ ] UTR preserved if evidence contains one
- [ ] Warm tone ("Thank you for sharing", "I can see this was...")
- [ ] Only asks about genuinely missing fields
- [ ] Correct pipeline routing
