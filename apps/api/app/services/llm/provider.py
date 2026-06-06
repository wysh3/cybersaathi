"""LLM provider abstraction for multiple backends (OpenAI-compatible).

Supported providers:
  - nvidia_nim: NVIDIA NIM (https://integrate.api.nvidia.com/v1)
  - deepseek:   DeepSeek API (https://api.deepseek.com)

Uses openai.AsyncOpenAI for all providers. Handles provider-specific
quirks: NIM enable_thinking=False, reasoning_content removal.

Configured via env vars:
  LLM_PROVIDER=deepseek
  DEEPSEEK_API_KEY=...
  NVIDIA_API_KEY=...               (only needed for vision)
  LLM_MODEL_INTAKE=deepseek-v4-flash
  LLM_MODEL_VISION=nvidia/nemotron-nano-12b-v2-vl
  LLM_ENABLED=true
  LLM_TIMEOUT_SECONDS=25
  LLM_MAX_RETRIES=2
"""

from __future__ import annotations

import json
import os
import time
from typing import Any, Optional

import yaml
from openai import AsyncOpenAI


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_DEFAULT_CONFIG = """
providers:
  default: deepseek
  nvidia_nim:
    base_url: https://integrate.api.nvidia.com/v1
    api_key_env: NVIDIA_API_KEY
    models:
      intake: nvidia/nemotron-3-nano-30b-a3b
      vision: nvidia/nemotron-nano-12b-v2-vl
  deepseek:
    base_url: https://api.deepseek.com
    api_key_env: DEEPSEEK_API_KEY
    models:
      intake: deepseek-v4-flash
      # DeepSeek chat models don't support vision — vision falls back to nvidia_nim
  google:
    base_url: https://generativelanguage.googleapis.com/v1beta
    api_key_env: GOOGLE_API_KEY
    models:
      tts: gemini-3.1-flash-tts-preview
"""


def _load_config() -> dict[str, Any]:
    """Load provider config from YAML or env, with sensible defaults."""
    config_path = os.environ.get("LLM_PROVIDER_CONFIG")
    if config_path and os.path.exists(config_path):
        with open(config_path) as f:
            return yaml.safe_load(f)
    return yaml.safe_load(_DEFAULT_CONFIG)


def _config() -> dict[str, Any]:
    return _load_config()


def _provider_name() -> str:
    """Return the active provider name (e.g. 'deepseek', 'nvidia_nim')."""
    return os.environ.get("LLM_PROVIDER") or str(_config().get("default", "deepseek"))


def _provider_config(name: str | None = None) -> dict[str, Any]:
    """Return config dict for a specific provider, or the active one."""
    cfg = _config()
    provider_name = name or _provider_name()
    try:
        return cfg["providers"][provider_name]
    except KeyError:
        raise RuntimeError(
            f"Unknown LLM provider '{provider_name}'. "
            f"Known providers: {list(cfg.get('providers', {}).keys())}"
        )


def is_llm_enabled() -> bool:
    """Check if LLM integration is enabled."""
    return os.environ.get("LLM_ENABLED", "false").lower() in ("true", "1", "yes")


def get_intake_model() -> str:
    """Return the model name for intake chat."""
    return os.environ.get("LLM_MODEL_INTAKE", _provider_config()["models"]["intake"])


def get_vision_model() -> str:
    """Return the model name for vision/image analysis.
    
    Falls back to nvidia_nim provider config since DeepSeek doesn't support vision.
    """
    env_model = os.environ.get("LLM_MODEL_VISION")
    if env_model:
        return env_model
    # Try active provider first, fall back to nvidia_nim
    try:
        return _provider_config()["models"]["vision"]
    except KeyError:
        return _provider_config("nvidia_nim")["models"]["vision"]


def get_timeout() -> float:
    return float(os.environ.get("LLM_TIMEOUT_SECONDS", "25"))


def get_max_retries() -> int:
    return int(os.environ.get("LLM_MAX_RETRIES", "2"))


# ---------------------------------------------------------------------------
# Clients (singletons)
# ---------------------------------------------------------------------------

_client: Optional[AsyncOpenAI] = None
_vision_client: Optional[AsyncOpenAI] = None


def _build_client(provider_name: str) -> AsyncOpenAI:
    """Build an AsyncOpenAI client for a given provider."""
    provider_cfg = _provider_config(provider_name)
    api_key = os.environ.get(provider_cfg["api_key_env"], "not-set")
    return AsyncOpenAI(
        base_url=provider_cfg["base_url"],
        api_key=api_key,
        timeout=get_timeout(),
        max_retries=get_max_retries(),
    )


def get_llm_client() -> AsyncOpenAI:
    """Return the singleton AsyncOpenAI client for the active chat provider."""
    global _client
    if _client is None:
        _client = _build_client(_provider_name())
    return _client


def _get_vision_client() -> AsyncOpenAI:
    """Return a singleton AsyncOpenAI client for vision (always NVIDIA NIM).
    
    DeepSeek chat models don't support vision/image inputs, so vision
    requests always route through NVIDIA NIM regardless of the active
    chat provider.
    """
    global _vision_client
    if _vision_client is None:
        _vision_client = _build_client("nvidia_nim")
    return _vision_client


# ---------------------------------------------------------------------------
# Reasoning content cleanup
# ---------------------------------------------------------------------------


def strip_reasoning_content(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Remove reasoning_content from assistant messages before re-sending.

    Some models (NIM, DeepSeek-R1) include reasoning_content in responses.
    Sending it back causes errors. We strip it and fall back to
    reasoning_content only if message.content is empty.
    """
    cleaned = []
    for msg in messages:
        cleaned_msg = {k: v for k, v in msg.items() if k != "reasoning_content"}
        # If content is empty but reasoning_content exists, use it as fallback
        if cleaned_msg.get("role") == "assistant" and not cleaned_msg.get("content"):
            if msg.get("reasoning_content"):
                cleaned_msg["content"] = msg["reasoning_content"]
        cleaned.append(cleaned_msg)
    return cleaned


# ---------------------------------------------------------------------------
# Chat completion
# ---------------------------------------------------------------------------


def _nim_extra_body() -> dict[str, Any]:
    """NIM-specific extra_body — disables thinking tokens."""
    return {"chat_template_kwargs": {"enable_thinking": False}}


def _deepseek_extra_body() -> dict[str, Any]:
    """DeepSeek V4 extra_body — disables thinking/chain-of-thought.

    DeepSeek V4 models (flash, pro) default to thinking=enabled.
    We explicitly disable it for CyberSaathi's non-reasoning intake flow.
    """
    return {"thinking": {"type": "disabled"}}


async def chat_completion(
    messages: list[dict[str, Any]],
    *,
    model: Optional[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 1200,
    response_format: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Send a chat completion request to the active provider.

    Returns the raw API response dict. Raises on error.
    """
    client = get_llm_client()
    model_name = model or get_intake_model()
    provider = _provider_name()

    cleaned_messages = strip_reasoning_content(messages)

    kwargs: dict[str, Any] = {
        "model": model_name,
        "messages": cleaned_messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    # NIM-specific: disable thinking tokens
    if provider == "nvidia_nim":
        kwargs["extra_body"] = _nim_extra_body()

    # DeepSeek V4: disable thinking (default is enabled)
    if provider == "deepseek":
        kwargs["extra_body"] = _deepseek_extra_body()

    if response_format:
        kwargs["response_format"] = response_format

    response = await client.chat.completions.create(**kwargs)
    return response.model_dump()


async def chat_completion_json(
    messages: list[dict[str, Any]],
    *,
    model: Optional[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 1200,
) -> dict[str, Any]:
    """Send a chat completion requesting JSON output."""
    return await chat_completion(
        messages,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
    )


def extract_content(response: dict[str, Any]) -> str:
    """Extract the text content from a chat completion response."""
    choices = response.get("choices", [])
    if not choices:
        return ""
    message = choices[0].get("message", {})
    content = message.get("content", "")
    if not content:
        content = message.get("reasoning_content", "")
    return content


def extract_usage(response: dict[str, Any]) -> dict[str, Any]:
    """Extract token usage from response."""
    usage = response.get("usage", {})
    if not usage:
        return {}
    return {
        "prompt_tokens": usage.get("prompt_tokens", 0),
        "completion_tokens": usage.get("completion_tokens", 0),
        "total_tokens": usage.get("total_tokens", 0),
    }


# ---------------------------------------------------------------------------
# Vision completion (always NVIDIA NIM)
# ---------------------------------------------------------------------------


_VISION_EXTRACTION_PROMPT = """Extract ALL readable text from this payment screenshot or SMS alert.
Return ONLY the extracted text — no commentary, no analysis, no markdown.
Focus on: amount, UPI ID, UTR/transaction reference, bank name, date/time, account numbers (masked or partial).
Output the text exactly as it appears in the image, preserving the order."""


async def chat_completion_vision(
    image_base64: str,
    *,
    model: Optional[str] = None,
    prompt: str | None = None,
    temperature: float = 0.1,
    max_tokens: int = 800,
) -> dict[str, Any]:
    """Send an image to the vision model and get extracted text.

    Always uses NVIDIA NIM for vision since DeepSeek chat models
    don't support image inputs.

    Returns the raw API response dict. The content will be the extracted text.
    """
    client = _get_vision_client()
    model_name = model or get_vision_model()

    user_content: list[dict[str, Any]] = [
        {"type": "text", "text": prompt or _VISION_EXTRACTION_PROMPT},
        {
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{image_base64}"},
        },
    ]

    messages = [{"role": "user", "content": user_content}]

    kwargs: dict[str, Any] = {
        "model": model_name,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    response = await client.chat.completions.create(**kwargs)
    return response.model_dump()
