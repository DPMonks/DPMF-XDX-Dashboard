import { normalizeLang } from "./aimLocale";

const VOICE_PREF_KEY = "aim.commander.voiceOn";

/** Locked premium target: sample 3b3c — Ryan deep + brisk (Edge TTS). */
export const COMMANDER_VOICE_TARGET = {
  id: "3b3c-deep-brisk",
  engine: "msedge-tts",
  voice: "en-GB-RyanNeural",
  rate: "+6%",
  pitch: "-10Hz",
  style: "jarvis-adjacent calm British deep brisk",
};

export function pickCommanderVoice(voices, lang = "en") {
  const list = Array.isArray(voices) ? voices : [];
  if (!list.length) return null;
  const want = normalizeLang(lang);
  const wantBase = want.split("-")[0].toLowerCase();

  const score = (v) => {
    const name = `${v.name || ""} ${v.lang || ""}`.toLowerCase();
    const vLang = String(v.lang || "").toLowerCase();
    let s = 0;
    if (vLang === want.toLowerCase() || vLang.startsWith(wantBase)) s += 24;
    else if (vLang.startsWith("en") && wantBase === "en") s += 12;
    if (/\bmale\b/.test(name)) s += 14;
    if (wantBase === "en" && /en(-|_)?gb/.test(name)) s += 16;
    if (wantBase === "en" && /(ryan|daniel|thomas|george|arthur)/.test(name)) s += 10;
    if (/(female|zira|samantha|karen|sonia|libby|aria)/.test(name)) s -= 22;
    if (v.localService) s += 2;
    return s;
  };

  return [...list].sort((a, b) => score(b) - score(a))[0] || null;
}

export function readVoicePref(defaultOn = true) {
  try {
    const raw = localStorage.getItem(VOICE_PREF_KEY);
    if (raw == null) return defaultOn;
    return raw === "1" || raw === "true";
  } catch {
    return defaultOn;
  }
}

export function writeVoicePref(on) {
  try {
    localStorage.setItem(VOICE_PREF_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

let currentAudio = null;

function speakBrowserFallback(text, lang) {
  const synth = window.speechSynthesis;
  if (!synth || !text) return;
  const utter = new SpeechSynthesisUtterance(String(text).slice(0, 1400));
  utter.rate = 1.08;
  utter.pitch = 0.82;
  utter.volume = 1;
  utter.lang = normalizeLang(lang);
  const applyVoice = () => {
    const voice = pickCommanderVoice(synth.getVoices(), lang);
    if (voice) {
      utter.voice = voice;
      if (voice.lang) utter.lang = voice.lang;
    }
    synth.cancel();
    synth.speak(utter);
  };
  const voices = synth.getVoices();
  if (voices?.length) applyVoice();
  else {
    const once = () => {
      synth.removeEventListener("voiceschanged", once);
      applyVoice();
    };
    synth.addEventListener("voiceschanged", once);
    window.setTimeout(applyVoice, 250);
  }
}

/** Prefer server Edge TTS (3b3c). Fall back to browser voice if speak API fails. */
export async function speakCommander(text, { voiceOn = true, lang = "en" } = {}) {
  if (!voiceOn || typeof window === "undefined") return;
  const line = String(text || "").trim();
  if (!line) return;

  stopCommanderSpeech();

  try {
    const res = await fetch("/api/aim/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: line.slice(0, 1400), lang: normalizeLang(lang) }),
    });
    if (!res.ok) throw new Error(`speak ${res.status}`);
    const type = res.headers.get("content-type") || "";
    if (!type.includes("audio")) throw new Error("not audio");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
    };
    await audio.play();
    return;
  } catch {
    speakBrowserFallback(line, lang);
  }
}

export function stopCommanderSpeech() {
  if (typeof window === "undefined") return;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.src = "";
    } catch {
      /* ignore */
    }
    currentAudio = null;
  }
}
