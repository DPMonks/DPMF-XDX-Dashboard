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

let audioCtx = null;
let activeSource = null;
let revealRaf = 0;
let revealTimer = 0;
let lastEngine = "none";
let pendingBuffer = null; // AudioBuffer ready for tap-to-play
let pendingText = "";
let playGen = 0;

function getAudioCtx() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

export function unlockCommanderAudio() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

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

function pronounceForSpeech(text) {
  return String(text || "")
    .replace(/\bXSQUAD\b/gi, "X Squad")
    .replace(/\bX-?SQUAD\b/gi, "X Squad");
}

function speakLangForEdge(lang) {
  const n = normalizeLang(lang || "en");
  if (n === "en" || n.startsWith("en-")) return n === "en" ? "en-GB" : n;
  return n;
}

function stopActiveSource() {
  if (activeSource) {
    try {
      activeSource.stop(0);
    } catch {
      /* ignore */
    }
    try {
      activeSource.disconnect();
    } catch {
      /* ignore */
    }
    activeSource = null;
  }
}

function syncBufferReveal(ctx, startedAt, duration, text, onProgress, onDone, gen) {
  clearRevealLoops();
  const total = String(text || "").length;
  const tick = () => {
    if (gen !== playGen) return;
    const elapsed = Math.max(0, ctx.currentTime - startedAt);
    const ratio = duration > 0 ? Math.min(1, elapsed / duration) : 1;
    emitProgress(onProgress, Math.floor(ratio * total), total);
    if (ratio < 1) revealRaf = requestAnimationFrame(tick);
  };
  emitProgress(onProgress, 0, total);
  revealRaf = requestAnimationFrame(tick);
}

async function playAudioBuffer(buffer, text, onProgress, onDone) {
  const ctx = getAudioCtx();
  if (!ctx || !buffer) throw new Error("no audio context");
  if (ctx.state === "suspended") await ctx.resume();
  stopActiveSource();
  clearRevealLoops();
  const gen = ++playGen;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  activeSource = source;
  const startedAt = ctx.currentTime;
  const duration = buffer.duration || 1;
  syncBufferReveal(ctx, startedAt, duration, text, onProgress, onDone, gen);
  await new Promise((resolve, reject) => {
    source.onended = () => {
      if (gen === playGen) {
        clearRevealLoops();
        emitProgress(onProgress, String(text || "").length, String(text || "").length);
        activeSource = null;
        if (typeof onDone === "function") onDone();
      }
      resolve();
    };
    try {
      source.start(0);
    } catch (err) {
      reject(err);
    }
  });
}

export function hasPendingCommanderAudio() {
  return Boolean(pendingBuffer);
}

/** Tap-to-play path (user gesture). */
export async function playPendingCommanderAudio({ onProgress, onDone, text = "" } = {}) {
  unlockCommanderAudio();
  const line = text || pendingText || "";
  if (!pendingBuffer) {
    if (typeof onDone === "function") onDone();
    return { mode: "none", engine: "none" };
  }
  try {
    await playAudioBuffer(pendingBuffer, line, onProgress, onDone);
    lastEngine = COMMANDER_VOICE_TARGET.id;
    return { mode: "edge", engine: lastEngine, needsPlay: false };
  } catch (err) {
    console.warn("[AIM] pending WebAudio play failed", err?.message || err);
    lastEngine = "edge-blocked";
    runTimedReveal(line, onProgress, onDone, { msPerChar: 16 });
    return { mode: "edge-blocked", engine: lastEngine, needsPlay: true, error: String(err?.message || err) };
  }
}

/**
 * Fetch Edge N1 MP3 and play via Web Audio (avoids CSP blocking blob: media URLs).
 */
export async function speakCommander(text, { voiceOn = true, lang = "en", onProgress, onDone } = {}) {
  const line = pronounceForSpeech(String(text || "")).trim();
  if (!line || typeof window === "undefined") {
    lastEngine = "none";
    if (typeof onDone === "function") onDone();
    return { mode: "none", engine: lastEngine };
  }

  stopCommanderSpeech({ keepPending: false });
  unlockCommanderAudio();

  if (!voiceOn) {
    lastEngine = "typewriter";
    runTimedReveal(line, onProgress, onDone, { msPerChar: 16 });
    return { mode: "typewriter", engine: lastEngine };
  }

  let voiceHeader = COMMANDER_VOICE_TARGET.id;
  let arrayBuffer;
  try {
    const res = await fetch("/api/aim/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: line.slice(0, 1400), lang: speakLangForEdge(lang) }),
    });
    if (!res.ok) throw new Error(`speak ${res.status}`);
    const type = res.headers.get("content-type") || "";
    if (!type.includes("audio")) throw new Error("not audio");
    voiceHeader = res.headers.get("x-aim-voice") || COMMANDER_VOICE_TARGET.id;
    arrayBuffer = await res.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength < 64) throw new Error("empty audio");
  } catch (err) {
    console.warn("[AIM] Edge speak API failed", err?.message || err);
    lastEngine = "browser-fallback";
    speakBrowserFallback(line, lang, onProgress, onDone);
    return { mode: "browser", engine: lastEngine, error: String(err?.message || err) };
  }

  const ctx = getAudioCtx();
  if (!ctx) {
    lastEngine = "browser-fallback";
    speakBrowserFallback(line, lang, onProgress, onDone);
    return { mode: "browser", engine: lastEngine };
  }

  try {
    if (ctx.state === "suspended") await ctx.resume();
    const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    pendingBuffer = buffer;
    pendingText = line;
    await playAudioBuffer(buffer, line, onProgress, onDone);
    lastEngine = voiceHeader;
    return { mode: "edge", engine: lastEngine, needsPlay: false };
  } catch (err) {
    console.warn("[AIM] WebAudio play blocked/failed; keep buffer for tap-to-play", err?.message || err);
    lastEngine = "edge-blocked";
    // Keep pendingBuffer for Play voice button (user gesture).
    runTimedReveal(line, onProgress, onDone, { msPerChar: 18 });
    return {
      mode: "edge-blocked",
      engine: lastEngine,
      needsPlay: true,
      error: String(err?.message || err),
    };
  }
}

function speakBrowserFallback(text, lang, onProgress, onDone) {
  const synth = window.speechSynthesis;
  const spoken = pronounceForSpeech(text);
  if (!synth || !spoken) {
    runTimedReveal(spoken || text, onProgress, onDone);
    return;
  }
  const line = spoken;
  const utter = new SpeechSynthesisUtterance(line.slice(0, 1400));
  utter.rate = 1.0;
  utter.pitch = 1.0;
  utter.volume = 1;
  utter.lang = speakLangForEdge(lang);
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
  utter.onerror = () => runTimedReveal(line, onProgress, onDone, { msPerChar: 22 });
  const applyVoice = () => {
    const voice = pickCommanderVoice(synth.getVoices(), "en-GB");
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

export function aimVoiceEngineLabel() {
  return lastEngine || COMMANDER_VOICE_TARGET.id;
}

export function stopCommanderSpeech({ keepPending = false } = {}) {
  if (typeof window === "undefined") return;
  playGen += 1;
  clearRevealLoops();
  stopActiveSource();
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
  if (!keepPending) {
    pendingBuffer = null;
    pendingText = "";
  }
}
