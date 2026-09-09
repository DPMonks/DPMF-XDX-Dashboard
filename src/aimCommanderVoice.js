import { normalizeLang } from "./aimLocale";

const VOICE_PREF_KEY = "aim.commander.voiceOn";

/** Locked natural target: N1 Ryan (no pitch/rate warp). */
export const COMMANDER_VOICE_TARGET = {
  id: "N1-ryan-natural",
  engine: "edge-tts-universal",
  voice: "en-GB-RyanNeural",
  rate: "+0%",
  pitch: "+0Hz",
  style: "natural British male",
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
let revealRaf = 0;
let revealTimer = 0;

function clearRevealLoops() {
  if (revealRaf) {
    cancelAnimationFrame(revealRaf);
    revealRaf = 0;
  }
  if (revealTimer) {
    clearInterval(revealTimer);
    revealTimer = 0;
  }
}

function emitProgress(onProgress, chars, total) {
  if (typeof onProgress !== "function") return;
  const n = Math.max(0, Math.min(total, chars | 0));
  onProgress({ chars: n, total, ratio: total ? n / total : 1 });
}

/** Soft typewriter when there is no audio clock (voice off / unknown duration). */
function runTimedReveal(text, onProgress, onDone, { msPerChar = 28 } = {}) {
  clearRevealLoops();
  const total = String(text || "").length;
  let i = 0;
  emitProgress(onProgress, 0, total);
  revealTimer = window.setInterval(() => {
    i = Math.min(total, i + 1);
    emitProgress(onProgress, i, total);
    if (i >= total) {
      clearRevealLoops();
      if (typeof onDone === "function") onDone();
    }
  }, Math.max(12, msPerChar));
}

function syncAudioReveal(audio, text, onProgress, onDone) {
  clearRevealLoops();
  const total = String(text || "").length;
  const tick = () => {
    if (!currentAudio || currentAudio !== audio) return;
    const dur = audio.duration;
    if (Number.isFinite(dur) && dur > 0) {
      const ratio = Math.min(1, Math.max(0, audio.currentTime / dur));
      emitProgress(onProgress, Math.floor(ratio * total), total);
    }
    if (!audio.paused && !audio.ended) {
      revealRaf = requestAnimationFrame(tick);
    }
  };
  const start = () => {
    emitProgress(onProgress, 0, total);
    revealRaf = requestAnimationFrame(tick);
  };
  if (audio.readyState >= 1 && Number.isFinite(audio.duration)) start();
  else audio.addEventListener("loadedmetadata", start, { once: true });

  audio.addEventListener(
    "ended",
    () => {
      clearRevealLoops();
      emitProgress(onProgress, total, total);
      if (typeof onDone === "function") onDone();
    },
    { once: true }
  );
}

function speakBrowserFallback(text, lang, onProgress, onDone) {
  const synth = window.speechSynthesis;
  if (!synth || !text) {
    runTimedReveal(text, onProgress, onDone);
    return;
  }
  const line = String(text);
  const utter = new SpeechSynthesisUtterance(line.slice(0, 1400));
  utter.rate = 1.0;
  utter.pitch = 1.0;
  utter.volume = 1;
  utter.lang = normalizeLang(lang);
  const total = line.length;
  emitProgress(onProgress, 0, total);
  utter.onboundary = (ev) => {
    if (typeof ev.charIndex === "number") {
      emitProgress(onProgress, Math.min(total, ev.charIndex + (ev.charLength || 1)), total);
    }
  };
  utter.onend = () => {
    emitProgress(onProgress, total, total);
    if (typeof onDone === "function") onDone();
  };
  utter.onerror = () => {
    runTimedReveal(line, onProgress, onDone, { msPerChar: 22 });
  };
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

/**
 * Prefer server Edge TTS (N1 natural). Fall back to browser voice if speak API fails.
 * onProgress({ chars, total, ratio }) fires as speech advances so UI can type in sync.
 */
export async function speakCommander(text, { voiceOn = true, lang = "en", onProgress, onDone } = {}) {
  const line = String(text || "").trim();
  if (!line || typeof window === "undefined") {
    if (typeof onDone === "function") onDone();
    return { mode: "none" };
  }

  stopCommanderSpeech();

  if (!voiceOn) {
    runTimedReveal(line, onProgress, onDone, { msPerChar: 16 });
    return { mode: "typewriter" };
  }

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
    syncAudioReveal(audio, line, onProgress, () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      if (typeof onDone === "function") onDone();
    });
    audio.onended = () => {
      /* ended also handled in syncAudioReveal */
    };
    await audio.play();
    return { mode: "edge" };
  } catch (err) {
    console.warn("[AIM] Edge speak failed, browser fallback", err?.message || err);
    speakBrowserFallback(line, lang, onProgress, onDone);
    return { mode: "browser" };
  }
}

export function aimVoiceEngineLabel() {
  return COMMANDER_VOICE_TARGET.id;
}

export function stopCommanderSpeech() {
  if (typeof window === "undefined") return;
  clearRevealLoops();
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
