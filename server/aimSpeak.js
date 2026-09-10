/** Natural Edge TTS default (N1). Avoid heavy pitch/rate warps - they sound robotic/glitchy. */
export const COMMANDER_EDGE_VOICE = {
  id: "N1-ryan-natural",
  voice: "en-GB-RyanNeural",
  rate: "+0%",
  pitch: "+0Hz",
};

const VOICE_BY_LANG = {
  en: "en-GB-RyanNeural",
  "en-GB": "en-GB-RyanNeural",
  es: "es-ES-AlvaroNeural",
  pt: "pt-BR-AntonioNeural",
  fr: "fr-FR-HenriNeural",
  de: "de-DE-ConradNeural",
  it: "it-IT-DiegoNeural",
  nl: "nl-NL-MaartenNeural",
  pl: "pl-PL-MarekNeural",
  ru: "ru-RU-DmitryNeural",
  ar: "ar-SA-HamedNeural",
  tr: "tr-TR-AhmetNeural",
  hi: "hi-IN-MadhurNeural",
  zh: "zh-CN-YunxiNeural",
  ja: "ja-JP-KeitaNeural",
  ko: "ko-KR-InJoonNeural",
};

function pickVoice(lang) {
  const raw = String(lang || "en");
  if (VOICE_BY_LANG[raw]) return VOICE_BY_LANG[raw];
  const base = raw.split("-")[0];
  return VOICE_BY_LANG[base] || COMMANDER_EDGE_VOICE.voice;
}


/** Spoken forms for tickers/names (display text stays unchanged). */
function pronounceForSpeech(text) {
  const words = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six" };
  const spell = (s) => String(s).split("").join(" ");
  return String(text || "")
    // Tx hashes: speak first 4 hex chars only
    .replace(/\b([A-Fa-f0-9]{64})\b/g, (_, h) => `${spell(h.slice(0, 4))} ...`)
    // Classic addresses: speak first 9 characters only
    .replace(/\b(r[1-9A-HJ-NP-Za-km-z]{24,34})\b/g, (_, a) => `${spell(a.slice(0, 9))} ...`)
    // Ledger / sequence numbers: speak first 4 digits only
    .replace(/\b(?:ledger(?:\s*index)?|ledgerIndex|Ledger)\s*[:=#-]?\s*(\d{4,})\b/gi, (_, n) => spell(String(n).slice(0, 4)))
    .replace(/\b(?:sequence|seq(?:uence)?\.?|Sequence)\s*[:=#-]?\s*(\d+)\b/gi, (_, n) => spell(String(n).slice(0, 4)))
    .replace(/\bseq(?:uence)?\s+(\d+)\b/gi, (_, n) => spell(String(n).slice(0, 4)))
    .replace(/\bledger\s+#?(\d{4,})\b/gi, (_, n) => spell(String(n).slice(0, 4)))
    .replace(/\b([1-6])\s*\/\s*([1-6])\b(?:\s*agents?)?/gi, (_, a, b) => {
      const left = words[a] || a;
      const right = words[b] || b;
      return `${left} out of ${right} agents`;
    })
    .replace(/\bagent\s*1\b/gi, "Agent Prime")
    .replace(/\bagent\s*2\b/gi, "Agent Flux")
    .replace(/\bagent\s*3\b/gi, "Agent Vector")
    .replace(/\bagent\s*4\b/gi, "Agent Vortex")
    .replace(/\bagent\s*5\b/gi, "Agent Echo")
    .replace(/\bagent1\b/gi, "Agent Prime")
    .replace(/\bagent2\b/gi, "Agent Flux")
    .replace(/\bagent3\b/gi, "Agent Vector")
    .replace(/\bagent4\b/gi, "Agent Vortex")
    .replace(/\bagent5\b/gi, "Agent Echo")
    .replace(/\bagent6\b/gi, "Agent Ghost")
    .replace(/\bagent\s*6\b/gi, "Agent Ghost")
    .replace(/\bAgent\s*Scout\b/gi, "Agent Ghost")
    .replace(/\bPRIME-0?1\b/gi, "Agent Prime")
    .replace(/\bFLUX-0?2\b/gi, "Agent Flux")
    .replace(/\bVECTOR-0?3\b/gi, "Agent Vector")
    .replace(/\bVORTEX-0?4\b/gi, "Agent Vortex")
    .replace(/\bECHO-0?5\b/gi, "Agent Echo")
    .replace(/\bRLUSD\b/gi, "are lussed")
    .replace(/\bXSQUAD\b/gi, "X Squad")
    .replace(/\bX-?SQUAD\b/gi, "X Squad")
    .replace(/\s{2,}/g, " ")
    .trim();
}


/** Same voice; improve pauses/rhythm via punctuation (no pitch warp, no voice change). */
function naturalizeSpeechPacing(text) {
  let s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return s;
  // Bullets / middle dots → spoken list pauses
  s = s.replace(/\s*[·•]\s*/g, ", ");
  // Em/en already stripped elsewhere; soft dashes as brief pauses
  s = s.replace(/\s+-\s+/g, ", ");
  // Breath after clause openers
  s = s.replace(/\b(However|Therefore|Meanwhile|Also|Next|Finally|So)\b\s+/gi, "$1, ");
  // Long sentences: insert a light pause before joining words if none nearby
  s = s.replace(/([^,]{48,}?)\s+\b(and|but|so|which|while|because)\b\s+/gi, "$1, $2 ");
  // Sentence end → short ellipsis pause (Edge treats ... as a beat)
  s = s.replace(/([.!?])\s+/g, "$1 ... ");
  // Collapse noisy pause stacks
  s = s.replace(/(?:\.\.\.\s*){2,}/g, "... ");
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

function envVoiceOverride() {
  const voice = String(process.env.AIM_TTS_VOICE || "").trim();
  const rate = String(process.env.AIM_TTS_RATE || "").trim() || "+0%";
  const pitch = String(process.env.AIM_TTS_PITCH || "").trim() || "+0Hz";
  const id = String(process.env.AIM_TTS_ID || "").trim() || "env-override";
  if (!voice) return null;
  return { id, voice, rate, pitch };
}

/** Optional studio-grade path: OpenAI audio/speech (needs a real OpenAI key, not Gemini). */
async function synthesizeOpenAiSpeech(cleaned, { lang = "en" } = {}) {
  const key = String(process.env.AIM_TTS_API_KEY || process.env.OPENAI_TTS_API_KEY || "").trim();
  if (!key) return { ok: false, error: "AIM_TTS_API_KEY unset" };
  const model = String(process.env.AIM_TTS_MODEL || "tts-1-hd").trim();
  const voice = String(process.env.AIM_TTS_OPENAI_VOICE || "onyx").trim();
  const base = String(process.env.AIM_TTS_BASE_URL || "https://api.openai.com/v1").trim().replace(/\/$/, "");
  const res = await fetch(`${base}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice,
      input: cleaned,
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 220);
    return { ok: false, error: `OpenAI TTS HTTP ${res.status}`, detail };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) return { ok: false, error: "Empty OpenAI audio" };
  return {
    ok: true,
    contentType: "audio/mpeg",
    buffer: buf,
    voice,
    rate: "n/a",
    pitch: "n/a",
    id: `openai-${model}-${voice}`,
    provider: "openai",
    lang,
  };
}

export async function synthesizeCommanderSpeech(text, { lang = "en" } = {}) {
  const cleaned = naturalizeSpeechPacing(
    pronounceForSpeech(String(text || ""))
      .replace(/\u2014/g, ". ")
      .replace(/\u2013/g, "-")
      .replace(/\s{2,}/g, " ")
      .trim()
  ).slice(0, 1400);
  if (!cleaned) return { ok: false, error: "Text required" };

  const provider = String(process.env.AIM_TTS_PROVIDER || "edge").trim().toLowerCase();
  if (provider === "openai" || provider === "openai-hd") {
    const oai = await synthesizeOpenAiSpeech(cleaned, { lang });
    if (oai.ok) return oai;
    // fall through to Edge if OpenAI fails
  }

  const override = envVoiceOverride();
  const locked = override || COMMANDER_EDGE_VOICE;
  const isEn = String(lang || "en").toLowerCase().startsWith("en");
  const voice = isEn ? locked.voice : pickVoice(lang);
  // Keep multilingual mild; English uses natural locked prosody (no deep warp).
  const rate = isEn ? locked.rate : "+0%";
  const pitch = isEn ? locked.pitch : "+0Hz";

  try {
    const { EdgeTTS } = await import("edge-tts-universal");
    const tts = new EdgeTTS(cleaned, voice, { rate, pitch });
    const result = await tts.synthesize();
    const audio = result?.audio;
    let buffer;
    if (Buffer.isBuffer(audio)) buffer = audio;
    else if (audio instanceof Uint8Array) buffer = Buffer.from(audio);
    else if (audio?.arrayBuffer) buffer = Buffer.from(await audio.arrayBuffer());
    else return { ok: false, error: "Unexpected audio payload" };
    if (!buffer.length) return { ok: false, error: "Empty audio" };
    return {
      ok: true,
      contentType: "audio/mpeg",
      buffer,
      voice,
      rate,
      pitch,
      id: locked.id,
      provider: "edge",
    };
  } catch (error) {
    return { ok: false, error: String(error?.message || error).slice(0, 240) };
  }
}

export async function aimSpeakPayload(req) {
  let body = {};
  try {
    if (req?.body && typeof req.body === "object") body = req.body;
    else {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      if (chunks.length) body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    }
  } catch {
    return { status: 400, body: { ok: false, error: "Invalid JSON" } };
  }
  const text = String(body.text || body.message || "").trim().slice(0, 1400);
  const lang = body.lang || "en";
  if (!text) return { status: 400, body: { ok: false, error: "Text required" } };

  const out = await synthesizeCommanderSpeech(text, { lang });
  if (!out.ok) {
    return {
      status: 503,
      body: {
        ok: false,
        error: "Speech synthesis failed",
        detail: out.error,
        hint: "Edge TTS needs edge-tts-universal. For studio voice set AIM_TTS_PROVIDER=openai and AIM_TTS_API_KEY.",
      },
    };
  }
  return {
    status: 200,
    audio: out.buffer,
    contentType: out.contentType,
    meta: {
      voice: out.voice,
      rate: out.rate,
      pitch: out.pitch,
      id: out.id,
      provider: out.provider || "edge",
    },
  };
}
