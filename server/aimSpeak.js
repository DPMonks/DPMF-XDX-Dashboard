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

function pickVoice(lang) {
  const raw = String(lang || "en");
  if (VOICE_BY_LANG[raw]) return VOICE_BY_LANG[raw];
  const base = raw.split("-")[0];
  return VOICE_BY_LANG[base] || COMMANDER_EDGE_VOICE.voice;
}

export async function synthesizeCommanderSpeech(text, { lang = "en" } = {}) {
  const cleaned = String(text || "")
    .replace(/\u2014/g, ". ")
    .replace(/\u2013/g, "-")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 1400);
  if (!cleaned) return { ok: false, error: "Text required" };

  const isEn = String(lang || "en").toLowerCase().startsWith("en");
  const voice = isEn ? COMMANDER_EDGE_VOICE.voice : pickVoice(lang);
  const rate = isEn ? COMMANDER_EDGE_VOICE.rate : "+2%";
  const pitch = isEn ? COMMANDER_EDGE_VOICE.pitch : "-2Hz";

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
        hint: "Add dependency edge-tts-universal and redeploy.",
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
