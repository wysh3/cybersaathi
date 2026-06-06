# DeepSeek V4 Provider Setup

## Configuration

In `apps/api/.env`:
```env
LLM_PROVIDER=deepseek
LLM_MODEL_INTAKE=deepseek-v4-flash
DEEPSEEK_API_KEY=sk-...
```

Vision always routes through NVIDIA NIM (`nvidia/nemotron-nano-12b-v2-vl`) since
DeepSeek chat models don't support image inputs. Vision config is separate:
```env
LLM_MODEL_VISION=nvidia/nemotron-nano-12b-v2-vl
NVIDIA_API_KEY=...
```

## Provider Quirk: Thinking Mode ON by Default

DeepSeek V4 models (both `deepseek-v4-flash` and `deepseek-v4-pro`) default to
**thinking=enabled**. Every response includes `reasoning_content` (hidden
chain-of-thought) which wastes tokens and can break multi-turn conversations if
not stripped.

### Fix: Explicitly Disable Thinking

In `provider.py`, add an `extra_body` with `thinking: {type: disabled}`:

```python
def _deepseek_extra_body() -> dict[str, Any]:
    """DeepSeek V4 extra_body — disables thinking/chain-of-thought."""
    return {"thinking": {"type": "disabled"}}
```

In `chat_completion()`, conditionally inject it:

```python
if provider == "deepseek":
    kwargs["extra_body"] = _deepseek_extra_body()
```

### DO NOT use `reasoning_effort: "none"`

DeepSeek's API rejects `reasoning_effort: "none"` with a 400 error. Valid values
are only `high`, `low`, `medium`, `max`, `xhigh`. The thinking toggle is
controlled exclusively through `extra_body={"thinking": {"type": "disabled"}}`,
not through `reasoning_effort`.

Error you'll get if you try `reasoning_effort: "none"`:
```
Error code: 400 - reasoning_effort: unknown variant `none`,
expected one of `high`, `low`, `medium`, `max`, `xhigh`
```

### Reasoning Content Cleanup

Even with thinking disabled, `reasoning_content` may appear in responses from
some models. The `strip_reasoning_content()` function in `provider.py` handles
this by removing `reasoning_content` from assistant messages before re-sending
in multi-turn conversations, falling back to `reasoning_content` only if
`content` is empty.

## Direct API Test

```python
import asyncio, os, sys
sys.path.insert(0, "/path/to/cybersaathi/apps/api")
sys.path.insert(0, "/path/to/cybersaathi/packages")

# Load .env
def load_dotenv(path):
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, val = line.partition('=')
            if key.strip() not in os.environ:
                os.environ[key.strip()] = val.strip()

load_dotenv("/path/to/cybersaathi/apps/api/.env")
os.environ["LLM_ENABLED"] = "true"

from app.services.llm.provider import chat_completion, extract_content, extract_usage

async def test():
    msgs = [{"role": "user", "content": "Reply with exactly one word: pong"}]
    resp = await chat_completion(msgs, max_tokens=50)
    content = extract_content(resp)
    usage = extract_usage(resp)
    choices = resp.get("choices", [])
    if choices:
        msg = choices[0].get("message", {})
        rc = msg.get("reasoning_content", "")
        assert not rc, f"Reasoning leaked: {rc[:100]}"
    assert "pong" in content.lower(), f"Expected pong, got: {content}"
    print(f"✅ Model={resp.get('model')} | Reasoning=NONE | Tokens={usage['total_tokens']}")

asyncio.run(test())
```

Expected output:
```
Model: deepseek-v4-flash
Content: 'pong'
Usage: {'prompt_tokens': 12, 'completion_tokens': 2, 'total_tokens': 14}
Reasoning: NONE ✅

✅ PASS — DeepSeek V4 Flash works with reasoning disabled
```
