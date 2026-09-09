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

let sharedAudio = null;
let audioCtx = null;
let currentObjectUrl = null;
let pendingObjectUrl = null;
let revealRaf = 0;
let revealTimer = 0;
let lastEngine = "none";

function getSharedAudio() {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = "auto";
    sharedAudio.setAttribute("playsinline", "true");
    sharedAudio.controls = false;
  }
  return sharedAudio;
}

function resumeAudioContext() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch {
    /* ignore */
  }
}

/**
 * Call synchronously from a user gesture (Send / Voice on / Play).
 * Do NOT mute the shared element — a stuck muted=true caused silent "success" plays.
 */
export function unlockCommanderAudio() {
  if (typeof window === "undefined") return;
  resumeAudioContext();
  const audio = getSharedAudio();
  if (!audio) return;
  try {
    audio.muted = false;
    audio.volume = 1;
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

function syncAudioReveal(audio, text, onProgress, onDone) {
  clearRevealLoops();
  const total = String(text || "").length;
  const tick = () => {
    if (!sharedAudio || sharedAudio !== audio) return;
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
  if (audio.readyState >= 1 && Number.isFinite(audio.duration) && durOk(audio)) start();
  else audio.addEventListener("loadedmetadata", start, { once: true });

  const finish = () => {
    clearRevealLoops();
    emitProgress(onProgress, total, total);
    revokeUrl(currentObjectUrl);
    currentObjectUrl = null;
    if (typeof onDone === "function") onDone();
  };
  audio.addEventListener("ended", finish, { once: true });
}

function durOk(audio) {
  return Number.isFinite(audio.duration) && audio.duration > 0;
}

function revokeUrl(url) {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}

function speakLangForEdge(lang) {
  const n = normalizeLang(lang || "en");
  if (n === "en" || n.startsWith("en-")) return n === "en" ? "en-GB" : n;
  return n;
}

async function waitCanPlay(audio) {
  if (audio.readyState >= 3) return;
  await new Promise((resolve, reject) => {
    const ok = () => {
      cleanup();
      resolve();
    };
    const bad = () => {
      cleanup();
      reject(new Error("audio error"));
    };
    const cleanup = () => {
      audio.removeEventListener("canplaythrough", ok);
      audio.removeEventListener("error", bad);
    };
    audio.addEventListener("canplaythrough", ok, { once: true });
    audio.addEventListener("error", bad, { once: true });
    window.setTimeout(ok, 2500);
  });
}

/**
 * Play a previously blocked Edge blob (call from a click on "Play voice").
 */
export async function playPendingCommanderAudio({ onProgress, onDone, text = "" } = {}) {
  unlockCommanderAudio();
  const audio = getSharedAudio();
  const url = pendingObjectUrl || currentObjectUrl;
  if (!audio || !url) {
    if (typeof onDone === "function") onDone();
    return { mode: "none", engine: "none" };
  }
  try {
    audio.muted = false;
    audio.volume = 1;
    if (audio.src !== url) audio.src = url;
    if (text) syncAudioReveal(audio, text, onProgress, onDone);
    await waitCanPlay(audio);
    await audio.play();
    lastEngine = COMMANDER_VOICE_TARGET.id;
    pendingObjectUrl = null;
    return { mode: "edge", engine: lastEngine };
  } catch (err) {
    console.warn("[AIM] pending play failed", err?.message || err);
    runTimedReveal(text || "", onProgress, onDone, { msPerChar: 16 });
    return { mode: "edge-blocked", engine: "edge-blocked", error: String(err?.message || err) };
  }
}

export function hasPendingCommanderAudio() {
  return Boolean(pendingObjectUrl);
}

export async function speakCommander(text, { voiceOn = true, lang = "en", onProgress, onDone } = {}) {
  const line = String(text || "").trim();
  if (!line || typeof window === "undefined") {
    lastEngine = "none";
    if (typeof onDone === "function") onDone();
    return { mode: "none", engine: lastEngine };
  }

  stopCommanderSpeech({ keepShared: true });
  unlockCommanderAudio();

  if (!voiceOn) {
    lastEngine = "typewriter";
    runTimedReveal(line, onProgress, onDone, { msPerChar: 16 });
    return { mode: "typewriter", engine: lastEngine };
  }

  let edgeBlob = null;
  let voiceHeader = "";
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
    edgeBlob = await res.blob();
    if (!edgeBlob || edgeBlob.size < 64) throw new Error("empty audio");
  } catch (err) {
    console.warn("[AIM] Edge speak API failed", err?.message || err);
    lastEngine = "browser-fallback";
    speakBrowserFallback(line, lang, onProgress, onDone);
    return { mode: "browser", engine: lastEngine, error: String(err?.message || err) };
  }

  const audio = getSharedAudio();
  revokeUrl(currentObjectUrl);
  revokeUrl(pendingObjectUrl);
  const url = URL.createObjectURL(edgeBlob);
  currentObjectUrl = url;
  pendingObjectUrl = url;

  try {
    audio.pause();
    audio.muted = false;
    audio.volume = 1;
    audio.src = url;
    audio.load();
    syncAudioReveal(audio, line, onProgress, () => {
      pendingObjectUrl = null;
      if (typeof onDone === "function") onDone();
    });
    await waitCanPlay(audio);
    resumeAudioContext();
    await audio.play();
    lastEngine = voiceHeader || COMMANDER_VOICE_TARGET.id;
    pendingObjectUrl = null;
    return { mode: "edge", engine: lastEngine, needsPlay: false };
  } catch (err) {
    console.warn("[AIM] Edge MP3 autoplay blocked; keep blob for tap-to-play", err?.message || err);
    lastEngine = "edge-blocked";
    // Reveal text now; keep pendingObjectUrl for Play voice button.
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
  if (!synth || !text) {
    runTimedReveal(text, onProgress, onDone);
    return;
  }
  const line = String(text);
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
  utter.onerror = () => {
    runTimedReveal(line, onProgress, onDone, { msPerChar: 22 });
  };
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

export function stopCommanderSpeech({ keepShared = false } = {}) {
  if (typeof window === "undefined") return;
  clearRevealLoops();
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
  if (sharedAudio) {
    try {
      sharedAudio.pause();
      if (!keepShared) {
        sharedAudio.removeAttribute("src");
        sharedAudio.load();
      }
    } catch {
      /* ignore */
    }
  }
  if (!keepShared) {
    revokeUrl(currentObjectUrl);
    revokeUrl(pendingObjectUrl);
    currentObjectUrl = null;
    pendingObjectUrl = null;
  }
}
