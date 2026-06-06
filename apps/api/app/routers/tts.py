"""TTS router — Gemini 3.1 Flash text-to-speech synthesis.

Calls the Gemini TTS API (gemini-3.1-flash-tts-preview) via the
generateContent endpoint. Output is 16-bit signed PCM at 24 kHz mono;
we wrap it in a WAV header so browsers can play it directly.

Auth: x-goog-api-key header (AI Studio API key).
Ref:  https://ai.google.dev/gemini-api/docs/speech-generation
"""

from __future__ import annotations

import base64
import io
import logging
import os
import re
import struct
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tts", tags=["tts"])

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview"
GEMINI_TTS_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_TTS_MODEL}:generateContent"
)
DEFAULT_VOICE = "Kore"  # per Gemini TTS docs
TTS_SAMPLE_RATE = 24000  # Hz — fixed by the model
TTS_CHANNELS = 1          # mono
TTS_SAMPLE_WIDTH = 2      # 16-bit


class TtsRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=8192, description="Text to synthesise")
    voice: str = Field(
        default=DEFAULT_VOICE,
        description="Voice name (Gemini TTS voice preset)",
    )


class TtsResponse(BaseModel):
    audio_base64: str = Field(..., description="Base64-encoded WAV audio (PCM→WAV wrapped)")
    mime_type: str = Field(default="audio/wav", description="Audio MIME type")
    text: str = Field(..., description="Echo of the synthesised text")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_api_key() -> str:
    key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if key:
        return key
    try:
        from app.services.llm.provider import _config as get_llm_config
        cfg = get_llm_config()
        google_cfg = cfg.get("providers", {}).get("google", {})
        api_key_env = google_cfg.get("api_key_env", "")
        if api_key_env:
            return os.environ.get(api_key_env, "")
    except Exception:
        pass
    return ""


def _pcm_to_wav(pcm_data: bytes, sample_rate: int, channels: int, sample_width: int) -> bytes:
    """Wrap raw PCM samples in a WAV (RIFF) header so browsers can play it."""
    byte_rate = sample_rate * channels * sample_width
    block_align = channels * sample_width
    data_size = len(pcm_data)

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_size,
        b"WAVE",
        b"fmt ",
        16,             # PCM
        1,              # audio format = PCM
        channels,
        sample_rate,
        byte_rate,
        block_align,
        sample_width * 8,  # bits per sample
        b"data",
        data_size,
    )
    return header + pcm_data


def _clean_text(text: str) -> str:
    """Strip markdown so speech sounds natural."""
    text = text.strip()
    text = text.replace("**", "").replace("*", "").replace("`", "")
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    return text


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/speak", response_model=TtsResponse)
async def text_to_speech(request: TtsRequest) -> TtsResponse:
    """Synthesise speech from text using Gemini 3.1 Flash TTS.

    Returns base64-encoded WAV audio (PCM wrapped with RIFF header).
    """
    api_key = _get_api_key()
    if not api_key:
        raise HTTPException(
            status_code=501,
            detail="GOOGLE_API_KEY not configured.",
        )

    text = _clean_text(request.text)
    if not text:
        raise HTTPException(status_code=400, detail="Text is empty after cleaning")

    body: dict[str, Any] = {
        "model": GEMINI_TTS_MODEL,
        "contents": [
            {"parts": [{"text": text}]}
        ],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {
                        "voiceName": request.voice,
                    }
                }
            },
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                GEMINI_TTS_URL,
                json=body,
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": api_key,
                },
            )
            response.raise_for_status()
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Gemini TTS timed out")
        except httpx.HTTPStatusError as e:
            logger.error("Gemini TTS HTTP %s: %s", e.response.status_code, e.response.text[:500])
            raise HTTPException(
                status_code=502,
                detail=f"Gemini TTS returned {e.response.status_code}",
            )

    data = response.json()

    # Extract PCM audio from Gemini response
    try:
        candidates = data.get("candidates", [])
        if not candidates:
            raise HTTPException(status_code=502, detail="Gemini TTS returned no candidates")

        parts = candidates[0].get("content", {}).get("parts", [])
        audio_part = None
        for part in parts:
            if "inlineData" in part:
                audio_part = part["inlineData"]
                break

        if not audio_part:
            logger.warning("Gemini TTS response missing inlineData: %s", str(data)[:500])
            raise HTTPException(status_code=502, detail="No audio data in Gemini TTS response")

        pcm_base64 = audio_part.get("data", "")
        if not pcm_base64:
            raise HTTPException(status_code=502, detail="Empty audio data from Gemini TTS")

        # Decode PCM, wrap in WAV header, re-encode
        pcm_bytes = base64.b64decode(pcm_base64)
        wav_bytes = _pcm_to_wav(pcm_bytes, TTS_SAMPLE_RATE, TTS_CHANNELS, TTS_SAMPLE_WIDTH)
        wav_base64 = base64.b64encode(wav_bytes).decode("ascii")

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to parse Gemini TTS response")
        raise HTTPException(status_code=502, detail=f"Failed to parse TTS response: {e}")

    return TtsResponse(
        audio_base64=wav_base64,
        mime_type="audio/wav",
        text=request.text,
    )
