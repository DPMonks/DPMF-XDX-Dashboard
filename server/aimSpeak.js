import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

/** Locked sample 3b3c. */
export const COMMANDER_EDGE_VOICE = {
  id: "3b3c-deep-brisk",
  voice: "en-GB-RyanNeural",
  rate: "+6%",
  pitch: "-10Hz",
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

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function pickVoice(lang) {
  const raw = String(lang || "en");
  if (VOICE_BY_LANG[raw]) return VOICE_BY_LANG[raw];
  const base = raw.split("-")[0];
  return VOICE_BY_LANG[base] || COMMANDER_EDGE_VOICE.voice;
}

function toSsml(text, { voice, rate, pitch }) {
  const body = escapeXml(String(text || "").slice(0, 1400));
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB">
  <voice name="${voice}">
    <prosody rate="${rate}" pitch="${pitch}">${body}</prosody>
  </voice>
</speak>`;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function synthesizeCommanderSpeech(text, { lang = "en" } = {}) {
  const cleaned = String(text || "").trim();
  if (!cleaned) {
    return { ok: false, error: "Text required" };
  }

  const base = pickVoice(lang);
  // Keep locked 3b3c prosody for English; other langs use mild defaults on their male neural voice.
  const isEn = String(lang || "en").toLowerCase().startsWith("en");
  const voice = isEn ? COMMANDER_EDGE_VOICE.voice : base;
  const rate = isEn ? COMMANDER_EDGE_VOICE.rate : "+2%";
  const pitch = isEn ? COMMANDER_EDGE_VOICE.pitch : "-2Hz";

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const ssml = toSsml(cleaned, { voice, rate, pitch });
    // Prefer SSML if supported; fall back to plain text.
    let audioStream;
    if (typeof tts.toStream === "function") {
      try {
        ({ audioStream } = await tts.toStream(ssml));
      } catch {
        ({ audioStream } = await tts.toStream(cleaned));
      }
    } else {
      return { ok: false, error: "msedge-tts toStream unavailable" };
    }
    const buffer = await streamToBuffer(audioStream);
    if (!buffer.length) return { ok: false, error: "Empty audio" };
    return {
      ok: true,
      contentType: "audio/mpeg",
      buffer,
      voice,
      rate,
      pitch,
      id: COMMANDER_EDGE_VOICE.id,
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
        hint: "Install msedge-tts dependency and redeploy.",
      },
    };
  }
  return {
    status: 200,
    audio: out.buffer,
    contentType: out.contentType,
    meta: { voice: out.voice, rate: out.rate, pitch: out.pitch, id: out.id },
  };
}
