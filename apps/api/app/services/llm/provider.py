"""LLM provider abstraction for NVIDIA NIM (OpenAI-compatible).

Uses openai.AsyncOpenAI pointed at https://integrate.api.nvidia.com/v1.
Handles NIM-specific quirks: enable_thinking=False, reasoning_content
removal, and redacted context only.

Configured via env vars:
  LLM_PROVIDER=nvidia_nim
  NVIDIA_API_KEY=...
  LLM_MODEL_INTAKE=nvidia/nemotron-3-nano-30b-a3b
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
  default: nvidia_nim
  nvidia_nim:
    base_url: https://integrate.api.nvidia.com/v1
    api_key_env: NVIDIA_API_KEY
    models:
      intake: nvidia/nemotron-3-nano-30b-a3b
"""


def _load_config() -> dict[str, Any]:
    """Load provider config from YAML or env, with sensible defaults."""
    config_path = os.environ.get("LLM_PROVIDER_CONFIG")
    if config_path and os.path.exists(config_path):
        with open(config_path) as f:
            return yaml.safe_load(f)
    return yaml.safe_load(_DEFAULT_CONFIG)


def _provider_config() -> dict[str, Any]:
    cfg = _load_config()
    provider_name = os.environ.get("LLM_PROVIDER", cfg.get("default", "nvidia_nim"))
    return cfg.get("providers", {}).get(provider_name, cfg["providers"]["nvidia_nim"])


def is_llm_enabled() -> bool:
    """Check if LLM integration is enabled."""
    return os.environ.get("LLM_ENABLED", "false").lower() in ("true", "1", "yes")


def get_intake_model() -> str:
    """Return the model name for intake chat."""
    return os.environ.get("LLM_MODEL_INTAKE", _provider_config()["models"]["intake"])


def get_timeout() -> float:
    return float(os.environ.get("LLM_TIMEOUT_SECONDS", "25"))


def get_max_retries() -> int:
    return int(os.environ.get("LLM_MAX_RETRIES", "2"))


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

_client: Optional[AsyncOpenAI] = None


def get_llm_client() -> AsyncOpenAI:
    """Return the singleton AsyncOpenAI client for NIM."""
    global _client
    if _client is None:
        provider_cfg = _provider_config()
        api_key = os.environ.get(provider_cfg["api_key_env"], "not-set")
        _client = AsyncOpenAI(
            base_url=provider_cfg["base_url"],
            api_key=api_key,
            timeout=get_timeout(),
            max_retries=get_max_retries(),
        )
    return _client


# ---------------------------------------------------------------------------
# NIM-specific message cleanup
# ---------------------------------------------------------------------------


def strip_reasoning_content(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Remove reasoning_content from assistant messages before re-sending to NIM.

    NIM models may include reasoning_content in responses. Sending it back
    causes errors. We strip it and fall back to reasoning_content only if
    message.content is empty.
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


async def chat_completion(
    messages: list[dict[str, Any]],
    *,
    model: Optional[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 1200,
    response_format: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Send a chat completion request to the NIM endpoint.

    Returns the raw API response dict. Raises on error.
    """
    client = get_llm_client()
    model_name = model or get_intake_model()

    cleaned_messages = strip_reasoning_content(messages)

    kwargs: dict[str, Any] = {
        "model": model_name,
        "messages": cleaned_messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "extra_body": {"chat_template_kwargs": {"enable_thinking": False}},
    }

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
