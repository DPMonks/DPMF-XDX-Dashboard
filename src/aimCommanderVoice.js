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
  const kick = () => {
    try {
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate || 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
  };
  if (ctx.state === "suspended") {
    ctx.resume().then(kick).catch(() => {});
  } else {
    kick();
  }
  try {
    if (window.speechSynthesis?.resume) window.speechSynthesis.resume();
  } catch {
    /* ignore */
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

const TX_HASH_RE = /\b[A-Fa-f0-9]{64}\b/g;

function emitProgress(onProgress, chars, total) {
  if (typeof onProgress !== "function") return;
  const n = Math.max(0, Math.min(total, chars | 0));
  onProgress({ chars: n, total, ratio: total ? n / total : 1 });
}

/** Hash chars are near-instant in the typewriter; normal prose stays readable. */
function revealWeights(text) {
  const s = String(text || "");
  const weights = Array.from(s, () => 1);
  const mark = (re) => {
    re.lastIndex = 0;
    for (const m of s.matchAll(re)) {
      const start = m.index || 0;
      for (let i = start; i < start + m[0].length; i += 1) weights[i] = 0.03;
    }
  };
  mark(/\b[A-Fa-f0-9]{64}\b/g);
  mark(/\br[1-9A-HJ-NP-Za-km-z]{24,34}\b/g);
  mark(/\b(?:sequence|seq(?:uence)?\.?)\s*[:=#-]?\s*\d+\b/gi);
  return weights;
}

function charsForWeightedRatio(weights, ratio) {
  if (!weights.length) return 0;
  const totalW = weights.reduce((a, b) => a + b, 0) || 1;
  let target = Math.max(0, Math.min(1, ratio)) * totalW;
  let acc = 0;
  for (let i = 0; i < weights.length; i += 1) {
    acc += weights[i];
    if (acc >= target) return i + 1;
  }
  return weights.length;
}

function runTimedReveal(text, onProgress, onDone, { msPerChar = 28 } = {}) {
  clearRevealLoops();
  const s = String(text || "");
  const total = s.length;
  const weights = revealWeights(s);
  let i = 0;
  emitProgress(onProgress, 0, total);
  revealTimer = window.setInterval(() => {
    // Burst through hash spans; normal text +1
    if (i < total && weights[i] < 0.5) {
      while (i < total && weights[i] < 0.5) i += 1;
    } else {
      i = Math.min(total, i + 1);
    }
    emitProgress(onProgress, i, total);
    if (i >= total) {
      clearRevealLoops();
      if (typeof onDone === "function") onDone();
    }
  }, Math.max(8, msPerChar));
}

function pronounceForSpeech(text) {
  const words = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five" };
  return String(text || "")
    .replace(/\b[A-Fa-f0-9]{64}\b/g, "as seen below")
    .replace(/\br[1-9A-HJ-NP-Za-km-z]{24,34}\b/g, "as seen below")
    .replace(/\b(?:sequence|seq(?:uence)?\.?|Sequence)\s*[:=#-]?\s*\d+\b/gi, "as seen below")
    .replace(/\bseq(?:uence)?\s+\d+\b/gi, "as seen below")
    .replace(/\b([1-5])\s*\/\s*([1-5])\b(?:\s*agents?)?/gi, (_, a, b) => {
      const left = words[a] || a;
      const right = words[b] || b;
      return `${left} out of ${right} agents`;
    })
    .replace(/\bXSQUAD\b/gi, "X Squad")
    .replace(/\bX-?SQUAD\b/gi, "X Squad")
    .replace(/\s{2,}/g, " ")
    .trim();
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
  const s = String(text || "");
  const total = s.length;
  const weights = revealWeights(s);
  const tick = () => {
    if (gen !== playGen) return;
    const elapsed = Math.max(0, ctx.currentTime - startedAt);
    const ratio = duration > 0 ? Math.min(1, elapsed / duration) : 1;
    emitProgress(onProgress, charsForWeightedRatio(weights, ratio), total);
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
    await playAudioBuffer(pendingBuffer, pronounceForSpeech(line) === line ? line : line, onProgress, onDone);
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
  const display = String(text || "").trim();
  const spoken = pronounceForSpeech(display).trim();
  if (!display || typeof window === "undefined") {
    lastEngine = "none";
    if (typeof onDone === "function") onDone();
    return { mode: "none", engine: lastEngine };
  }

  stopCommanderSpeech({ keepPending: false });
  unlockCommanderAudio();

  if (!voiceOn) {
    lastEngine = "typewriter";
    runTimedReveal(display, onProgress, onDone, { msPerChar: 16 });
    return { mode: "typewriter", engine: lastEngine };
  }

  let voiceHeader = COMMANDER_VOICE_TARGET.id;
  let arrayBuffer;
  try {
    const res = await fetch("/api/aim/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: spoken.slice(0, 1400), lang: speakLangForEdge(lang) }),
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
    speakBrowserFallback(display, lang, onProgress, onDone);
    return { mode: "browser", engine: lastEngine, error: String(err?.message || err) };
  }

  const ctx = getAudioCtx();
  if (!ctx) {
    lastEngine = "browser-fallback";
    speakBrowserFallback(display, lang, onProgress, onDone);
    return { mode: "browser", engine: lastEngine };
  }

  try {
    if (ctx.state === "suspended") await ctx.resume();
    const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    pendingBuffer = buffer;
    pendingText = display;
    await playAudioBuffer(buffer, display, onProgress, onDone);
    lastEngine = voiceHeader;
    pendingBuffer = null;
    pendingText = "";
    return { mode: "edge", engine: lastEngine, needsPlay: false };
  } catch (err) {
    console.warn("[AIM] WebAudio play blocked/failed; auto browser speak", err?.message || err);
    // Keep N1 buffer for optional Play voice, but always speak now via browser TTS.
    lastEngine = "browser-fallback";
    try {
      speakBrowserFallback(display, lang, onProgress, onDone);
      return {
        mode: "browser",
        engine: lastEngine,
        needsPlay: Boolean(pendingBuffer),
        error: String(err?.message || err),
      };
    } catch (err2) {
      lastEngine = "edge-blocked";
      runTimedReveal(display, onProgress, onDone, { msPerChar: 16 });
      return {
        mode: "edge-blocked",
        engine: lastEngine,
        needsPlay: Boolean(pendingBuffer),
        error: String(err2?.message || err2),
      };
    }
  }
}

function speakBrowserFallback(text, lang, onProgress, onDone) {
  const synth = window.speechSynthesis;
  const display = String(text || "");
  const spoken = pronounceForSpeech(display);
  if (!synth || !spoken) {
    runTimedReveal(display || spoken, onProgress, onDone, { msPerChar: 16 });
    return;
  }
  const utter = new SpeechSynthesisUtterance(spoken.slice(0, 1400));
  utter.rate = 1;
  utter.pitch = 1;
  utter.lang = speakLangForEdge(lang);
  const total = display.length;
  const weights = revealWeights(display);
  emitProgress(onProgress, 0, total);
  utter.onboundary = (ev) => {
    // Drive reveal from speech progress but burst identifiers
    const approx = Math.min(1, (ev.charIndex + (ev.charLength || 1)) / Math.max(1, spoken.length));
    emitProgress(onProgress, charsForWeightedRatio(weights, approx), total);
  };
  utter.onend = () => {
    emitProgress(onProgress, total, total);
    if (typeof onDone === "function") onDone();
  };
  utter.onerror = () => runTimedReveal(display, onProgress, onDone, { msPerChar: 12 });
  try {
    synth.cancel();
    synth.speak(utter);
  } catch {
    runTimedReveal(display, onProgress, onDone, { msPerChar: 12 });
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
