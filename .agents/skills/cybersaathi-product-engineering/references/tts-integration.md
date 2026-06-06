# TTS Integration (Gemini 3.1 Flash TTS)

Add a "Listen" button to assistant chat bubbles using Gemini 3.1 Flash TTS
(`gemini-3.1-flash-tts-preview`). The backend calls the Google Gemini API to
synthesise audio, wraps raw PCM in a WAV header, returns base64-encoded WAV,
and the frontend plays it with an `HTMLAudioElement`.

Source of truth: https://ai.google.dev/gemini-api/docs/speech-generation
**Always read the live docs before touching this code — model names, voices,
and API surface change.**

## Architecture

```
ChatBubble (frontend)
  → api.tts(text)
    → POST /tts/speak (FastAPI)
      → Gemini TTS API (generativelanguage.googleapis.com)
        ← raw PCM (16-bit signed, 24 kHz mono) via inlineData
      → PCM→WAV header wrapping → base64
      ← { audio_base64, mime_type: "audio/wav" }
    → Audio playback via new Audio("data:audio/wav;base64,...")
```

### Why not Web Speech API

The browser SpeechSynthesis API produces inconsistent quality across OSes
(macOS is fine, Linux Chromium needs espeak-ng), and offers no control over
voice style. Gemini 3.1 Flash TTS gives high-fidelity, consistent output
with fine-grained voice control — critical for emergency guidance where
clarity matters.

## Backend

### Router: `apps/api/app/routers/tts.py`

- **Endpoint:** `POST /tts/speak`
- **Request:** `{ "text": "...", "voice": "Kore" }`
- **Response:** `{ "audio_base64": "...", "mime_type": "audio/wav", "text": "..." }`
- **Auth:** `x-goog-api-key` header (NOT `?key=` query param)
- **Model:** `gemini-3.1-flash-tts-preview`
- **Required config:** `generationConfig.responseModalities: ["AUDIO"]`
- **Output:** Raw PCM (16-bit signed, 24000 Hz, mono) → backend wraps in
  RIFF/WAV header so browsers can play it natively.
- **Voice:** Default `Kore` (per current Gemini TTS docs). Check live docs
  for available voices before changing.
- **Text cleaning:** Strips `**bold**`, `*italic*`, backticks, and markdown
  links before sending to Gemini for natural speech output.

### Gemini API request shape (from docs)

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3.1-flash-tts-preview",
    "contents": [{"parts":[{"text": "hello"}]}],
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "speechConfig": {
        "voiceConfig": {
          "prebuiltVoiceConfig": {"voiceName": "Kore"}
        }
      }
    }
  }' | jq -r '.candidates[0].content.parts[0].inlineData.data' | base64 --decode > out.pcm
ffmpeg -f s16le -ar 24000 -ac 1 -i out.pcm out.wav
```

### Provider config: `app/services/llm/provider.py`

```yaml
google:
  base_url: https://generativelanguage.googleapis.com/v1beta
  api_key_env: GOOGLE_API_KEY
  models:
    tts: gemini-3.1-flash-tts-preview
```

### Registration

- `app/routers/__init__.py` — exports `tts_router`
- `app/main.py` — `app.include_router(tts_router)`

## Frontend

### API client: `apps/web/lib/api.ts`

```ts
tts: (text: string) =>
  request<{ audio_base64: string; mime_type: string; text: string }>(
    `/tts/speak`,
    { method: "POST", body: JSON.stringify({ text }) },
  ),
```

### ChatBubble: `apps/web/components/intake/ChatIntakeComposer.tsx`

```tsx
const [speaking, setSpeaking] = useState(false);
const [loading, setLoading] = useState(false);
const audioRef = useRef<HTMLAudioElement | null>(null);

async function handleSpeak() {
  // Toggle off if already playing
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current = null;
    setSpeaking(false);
    return;
  }

  setLoading(true);
  try {
    const response = await api.tts(msg.content_redacted);
    const audio = new Audio(
      `data:${response.mime_type};base64,${response.audio_base64}`
    );
    audio.onended = () => { audioRef.current = null; setSpeaking(false); };
    audio.onerror = () => { audioRef.current = null; setSpeaking(false); };
    audioRef.current = audio;
    await audio.play();
    setSpeaking(true);
  } catch (err) {
    toast.error("Could not read message aloud");
  } finally {
    setLoading(false);
  }
}
```

### Button styling

```tsx
{!isUser && hasContent && (
  <button
    onClick={handleSpeak}
    disabled={loading}
    className={cn(
      "mt-2 inline-flex ... rounded-full px-2.5 py-1 text-[10px] font-medium",
      speaking ? "bg-sky-500 text-white" : "bg-sky-50 text-sky-500 hover:bg-sky-100",
      loading && "opacity-50 cursor-wait",
    )}
  >
    {loading ? <Loader2 className="size-3 animate-spin" />
      : speaking ? <VolumeX className="size-3" />
      : <Volume2 className="size-3" />}
    {loading ? "Loading…" : speaking ? "Stop" : "Listen"}
  </button>
)}
```

Three states:
- **Idle:** `bg-sky-50` pill, Volume2 icon, "Listen"
- **Loading:** `opacity-50`, spinning Loader2, "Loading…"
- **Playing:** `bg-sky-500 text-white`, VolumeX icon, "Stop"

## Pitfalls

- **API key format.** Must be an `AIza`-prefixed Google AI Studio key.
  `AQ.` prefix OAuth tokens are not accepted. Set `GOOGLE_API_KEY` in
  `apps/api/.env`.
- **Auth header, not query param.** Use `x-goog-api-key` header. The
  `?key=` query param does not work for this endpoint.
- **Output is PCM, not WAV.** Gemini TTS returns raw 16-bit signed PCM
  at 24000 Hz mono. The backend wraps it in a WAV (RIFF) header before
  returning to the frontend. Without the header, browsers cannot play it.
- **`responseModalities` is required.** The `generationConfig` MUST
  include `"responseModalities": ["AUDIO"]`. Without it, the API returns
  text instead of audio.
- **Model name in URL AND body.** The model name appears in both the URL
  path and the `"model"` field in the request body.
- **Markdown in text.** The backend strips bold/italic/link formatting
  before sending to Gemini. Raw `**bold**` would be read as "asterisk
  asterisk bold asterisk asterisk".
- **Audio autoplay.** Some browsers block `Audio.play()` without a user
  gesture. The click handler satisfies this.
- **Model names change.** `gemini-2.5-flash-preview-tts` became
  `gemini-3.1-flash-tts-preview`. Voice names also change. Always check
  https://ai.google.dev/gemini-api/docs/speech-generation before coding.
- **Rate limiting.** Gemini free tier has rate limits. For production,
  consider caching TTS responses or upgrading.

## Files modified

- `apps/api/app/routers/tts.py` (new)
- `apps/api/app/routers/__init__.py` — exports `tts_router`
- `apps/api/app/main.py` — includes `tts_router`
- `apps/api/app/services/llm/provider.py` — adds `google` provider
- `apps/api/.env` — `GOOGLE_API_KEY`
- `apps/web/lib/api.ts` — `api.tts()`
- `apps/web/components/intake/ChatIntakeComposer.tsx` — ChatBubble TTS
