import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAimStatus, postAimChat, getAimLocale, classicAimWallet } from "../api/aim";
import { AIM_LANGUAGES, normalizeLang, readLangPref, writeLangPref } from "../aimLocale";
import { aimVoiceEngineLabel, playPendingCommanderAudio, readVoicePref, speakCommander, stopCommanderSpeech, unlockCommanderAudio, writeVoicePref } from "../aimCommanderVoice";
import { AIM_AGENT_IDS, AIM_COMMANDER_AVATAR, aimAgentLabel, aimAgentRole, aimAgentProfile } from "../aimAgentNames";
import AimAgentName from "./AimAgentName";
import AimAgentAvatar from "./AimAgentAvatar";
import { useWallet } from "../context/useWallet";
import { useChartSnapshot } from "../context/chartSnapshot";
import { getChartAction, publishChartAction, subscribeChartNarrate } from "../context/chartAction";
import { clearAimChatAsk, useAimChatAsk } from "../context/aimChatAsk";
import { AIM_ADMIN_WALLET } from "../constants/ledger";
import AimDeskSmartChart from "./AimDeskSmartChart";

function ago(iso) {
  if (!iso) return "-";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "-";
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return `${Math.round(sec / 3600)}h ago`;
}

function isAimMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;
}

/** Throttle typewriter reveal updates on mobile to cut layout churn. */
function createRevealProgress(applyChars, { minMs = 90, minStep = 8 } = {}) {
  let lastAt = 0;
  let lastChars = -1;
  let pending = null;
  let timer = 0;
  const flush = () => {
    timer = 0;
    if (pending == null) return;
    const chars = pending;
    pending = null;
    lastAt = Date.now();
    lastChars = chars;
    applyChars(chars);
  };
  return {
    onProgress({ chars }) {
      if (!isAimMobileViewport()) {
        applyChars(chars);
        return;
      }
      pending = chars;
      const now = Date.now();
      const due = now - lastAt >= minMs || chars - lastChars >= minStep;
      if (due) {
        if (timer) {
          clearTimeout(timer);
          timer = 0;
        }
        flush();
        return;
      }
      if (!timer) timer = window.setTimeout(flush, Math.max(16, minMs - (now - lastAt)));
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = 0;
      }
      flush();
    },
  };
}

export default function AiMatrixPanel({ onChartPropsChange = null, showInlineChart = true } = {}) {
  const { walletAddress } = useWallet();
  const chartSnapshot = useChartSnapshot();
  const aimChatAsk = useAimChatAsk();
  // Only show Admin teach on when the same classic wallet will be sent on chat.
  const chatWallet = classicAimWallet(walletAddress);
  const isAimAdmin = Boolean(chatWallet) && chatWallet === AIM_ADMIN_WALLET;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [localChat, setLocalChat] = useState([]);
  const [voiceOn, setVoiceOn] = useState(() => readVoicePref(true));
  const [langPref, setLangPref] = useState(() => readLangPref());
  const [suggestedLang, setSuggestedLang] = useState("en");
  const [langSource, setLangSource] = useState("auto");
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const chatLogRef = useRef(null);
  const chatFormRef = useRef(null);
  const chatInputRef = useRef(null);
  const sendMessageRef = useRef(null);
  const handledAskSeqRef = useRef(0);
  const sendGenRef = useRef(0);
  const [movePage, setMovePage] = useState(0);
  const [moveSwap, setMoveSwap] = useState(false);
  const [pulsePage, setPulsePage] = useState(0);
  const [pulseSwap, setPulseSwap] = useState(false);

  const effectiveLang = langPref === "auto" ? suggestedLang : normalizeLang(langPref);

  const refresh = useCallback(async () => {
    try {
      const next = await getAimStatus();
      setData(next);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load AI-Matrix");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 30000);
    return () => {
      window.clearInterval(id);
      stopCommanderSpeech();
    };
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loc = await getAimLocale();
        if (cancelled) return;
        setSuggestedLang(normalizeLang(loc.lang || "en"));
        setLangSource(loc.source || "ip");
      } catch {
        if (!cancelled) {
          const nav = (typeof navigator !== "undefined" && navigator.language) || "en";
          setSuggestedLang(normalizeLang(nav));
          setLangSource("browser");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function finishSpeakingRows(rows) {
    return rows.map((r) =>
      r.speaking || r.pending
        ? { ...r, speaking: false, pending: false, reveal: (r.text || "").length }
        : r
    );
  }

  function toggleVoice() {
    setVoiceOn((prev) => {
      const next = !prev;
      writeVoicePref(next);
      if (!next) {
        stopCommanderSpeech();
        setLocalChat((rows) => finishSpeakingRows(rows));
      } else unlockCommanderAudio();
      return next;
    });
  }

  function onLangChange(nextCode) {
    const next = nextCode || "auto";
    setLangPref(next);
    writeLangPref(next);
    setLangMenuOpen(false);
  }

  useEffect(() => {
    if (!langMenuOpen) return undefined;
    function onDoc(event) {
      if (!event.target?.closest?.(".aim-lang")) setLangMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [langMenuOpen]);

  // Pin newest line inside the capped chat viewport (do not grow the page).
  useEffect(() => {
    const el = chatLogRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      const node = chatLogRef.current;
      if (!node) return;
      node.scrollTop = node.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [localChat]);

  async function sendCommanderMessage(rawMessage) {
    const message = String(rawMessage || "").trim();
    if (!message) return;

    // Interrupt any in-flight compose/speech so the user can barge in mid-reply.
    stopCommanderSpeech();
    const myGen = ++sendGenRef.current;

    setBusy(true);
    if (voiceOn) {
      unlockCommanderAudio();
      try { window.speechSynthesis?.resume?.(); } catch { /* ignore */ }
    }
    const thinkingId = `thinking-${Date.now()}`;
    setLocalChat((rows) => [
      // Drop prior "Composing..." bubbles; finalize any mid-reveal speech rows.
      ...finishSpeakingRows(rows.filter((r) => !r.pending)),
      { role: "you", text: message, at: new Date().toISOString() },
      {
        id: thinkingId,
        role: "commander",
        text: "Composing...",
        at: new Date().toISOString(),
        pending: true,
        reveal: 11,
      },
    ]);
    setText("");
    try {
      const pendingAction = getChartAction();
      const pending_chart_action =
        pendingAction && pendingAction.type === "ask_side"
          ? {
              type: "ask_side",
              side: pendingAction.side || null,
              pair: pendingAction.pair || null,
              timeframe: pendingAction.timeframe || null,
              pending_question: pendingAction.pending_question || null,
            }
          : null;
      const out = await postAimChat(message, {
        lang: langPref === "auto" ? "auto" : effectiveLang,
        wallet: chatWallet || classicAimWallet(walletAddress) || null,
        account: chatWallet || classicAimWallet(walletAddress) || null,
        address: chatWallet || classicAimWallet(walletAddress) || null,
        chart_context: chartSnapshot || null,
        pending_chart_action,
      });
      if (myGen !== sendGenRef.current) return;
      let reply = out.reply?.body?.text || "Queued.";
      if (out.teach_ack && !String(reply).includes(" ack")) {
        reply = `${String(reply).trimEnd()} ack`;
      }
      const chartAction =
        out.chart_action ||
        out.reply?.body?.chart_action ||
        out.reply?.chart_action ||
        null;
      const replyLang = out.lang || effectiveLang;
      const isLayTools = chartAction && chartAction.type === "lay_tools";
      let spoken = { engine: aimVoiceEngineLabel(), needsPlay: false };
      if (isLayTools) {
        // Progressive narrate while AI cursor places tools; keep full theory in chat.
        const replyId = `cmd-${Date.now()}`;
        setLocalChat((rows) => [
          ...rows.filter((r) => r.id !== thinkingId),
          {
            id: replyId,
            role: "commander",
            text: reply,
            at: new Date().toISOString(),
            lang: replyLang,
            reveal: Math.min(120, reply.length),
            speaking: true,
          },
        ]);
        const queue = [];
        let wake = null;
        const wait = () =>
          new Promise((resolve) => {
            wake = resolve;
          });
        const unsub = subscribeChartNarrate((step) => {
          if (!step?.text) return;
          queue.push(step);
          if (wake) {
            const r = wake;
            wake = null;
            r();
          }
        });
        publishChartAction(chartAction);
        const seen = new Set();
        const deadline = Date.now() + 45000;
        while (Date.now() < deadline) {
          if (myGen !== sendGenRef.current) break;
          if (!queue.length) {
            const step = await Promise.race([
              wait().then(() => queue.shift()),
              new Promise((r) => setTimeout(() => r(null), 400)),
            ]);
            if (step) queue.unshift(step);
            if (!queue.length) {
              // If HybridChart already finished (skip/fast), stop waiting once we have spoken open/close or timeout soft
              if (seen.has("done") || seen.has("close")) break;
              continue;
            }
          }
          const step = queue.shift();
          if (!step?.text || seen.has(step.id || step.text)) continue;
          seen.add(step.id || step.text);
          if (step.id === "close") {
            // Speak theory as the closing line on the main bubble
            {
              const reveal = createRevealProgress((chars) => {
                if (myGen !== sendGenRef.current) return;
                setLocalChat((rows) =>
                  rows.map((r) => (r.id === replyId ? { ...r, reveal: chars, speaking: true } : r))
                );
              });
              spoken = await speakCommander(step.text || reply, {
                voiceOn,
                lang: replyLang,
                onProgress: reveal.onProgress,
                onDone: () => {
                  reveal.flush();
                  if (myGen !== sendGenRef.current) return;
                  setLocalChat((rows) =>
                    rows.map((r) =>
                      r.id === replyId ? { ...r, reveal: reply.length, speaking: false } : r
                    )
                  );
                },
              });
            }
            continue;
          }
          if (step.id === "done") break;
          const lineId = `cmd-n-${Date.now()}-${seen.size}`;
          setLocalChat((rows) => [
            ...rows,
            {
              id: lineId,
              role: "commander",
              text: step.text,
              at: new Date().toISOString(),
              lang: replyLang,
              reveal: 0,
              speaking: true,
              narrate: true,
            },
          ]);
          {
            const reveal = createRevealProgress((chars) => {
              if (myGen !== sendGenRef.current) return;
              setLocalChat((rows) =>
                rows.map((r) => (r.id === lineId ? { ...r, reveal: chars, speaking: true } : r))
              );
            });
            await speakCommander(step.text, {
              voiceOn,
              lang: replyLang,
              onProgress: reveal.onProgress,
              onDone: () => {
                reveal.flush();
                if (myGen !== sendGenRef.current) return;
                setLocalChat((rows) =>
                  rows.map((r) =>
                    r.id === lineId ? { ...r, reveal: step.text.length, speaking: false } : r
                  )
                );
              },
            });
          }
        }
        unsub();
        setLocalChat((rows) =>
          rows.map((r) =>
            r.id === replyId
              ? {
                  ...r,
                  reveal: reply.length,
                  speaking: false,
                  voiceEngine: spoken?.engine || aimVoiceEngineLabel(),
                  needsPlay: !!spoken?.needsPlay,
                }
              : r
          )
        );
      } else {
        if (chartAction && typeof chartAction === "object") {
          publishChartAction(chartAction);
        }
        const replyId = `cmd-${Date.now()}`;
        setLocalChat((rows) => [
          ...rows.filter((r) => r.id !== thinkingId),
          {
            id: replyId,
            role: "commander",
            text: reply,
            at: new Date().toISOString(),
            lang: replyLang,
            reveal: 0,
            speaking: true,
          },
        ]);
        {
          const reveal = createRevealProgress((chars) => {
            if (myGen !== sendGenRef.current) return;
            setLocalChat((rows) =>
              rows.map((r) => (r.id === replyId ? { ...r, reveal: chars, speaking: true } : r))
            );
          });
          spoken = await speakCommander(reply, {
            voiceOn,
            lang: replyLang,
            onProgress: reveal.onProgress,
            onDone: () => {
              reveal.flush();
              if (myGen !== sendGenRef.current) return;
              setLocalChat((rows) =>
                rows.map((r) =>
                  r.id === replyId ? { ...r, reveal: reply.length, speaking: false } : r
                )
              );
            },
          });
        }
        if (myGen !== sendGenRef.current) return;
        setLocalChat((rows) =>
          rows.map((r) =>
            r.id === replyId
              ? {
                  ...r,
                  voiceEngine: spoken?.engine || aimVoiceEngineLabel(),
                  needsPlay: !!spoken?.needsPlay,
                }
              : r
          )
        );
      }
      await refresh();
    } catch (err) {
      if (myGen !== sendGenRef.current) return;
      setLocalChat((rows) => [
        ...rows.filter((r) => r.id !== thinkingId),
        { role: "system", text: err.message || "Chat failed", at: new Date().toISOString() },
      ]);
    } finally {
      if (myGen === sendGenRef.current) setBusy(false);
    }
  }

  async function onSend(event) {
    event.preventDefault();
    await sendCommanderMessage(text);
  }

  sendMessageRef.current = sendCommanderMessage;

  useEffect(() => {
    if (!aimChatAsk?.seq || !aimChatAsk.text) return;
    if (aimChatAsk.seq === handledAskSeqRef.current) return;
    handledAskSeqRef.current = aimChatAsk.seq;
    const msg = String(aimChatAsk.text || "").trim();
    if (!msg) return;
    const focus = aimChatAsk.focus;
    (async () => {
      try {
        if (focus) {
          chatFormRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
          chatInputRef.current?.focus?.();
        }
        await new Promise((r) => window.setTimeout(r, 120));
        await sendMessageRef.current?.(msg);
      } finally {
        clearAimChatAsk();
      }
    })();
    // send via ref so the latest compose path is used without re-binding deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aimChatAsk]);

  async function onPlayVoice(message) {
    if (!message?.id) return;
    unlockCommanderAudio();
    setLocalChat((rows) =>
      rows.map((r) => (r.id === message.id ? { ...r, speaking: true, needsPlay: false } : r))
    );
    {
      const reveal = createRevealProgress((chars) => {
        setLocalChat((rows) =>
          rows.map((r) => (r.id === message.id ? { ...r, reveal: chars, speaking: true } : r))
        );
      });
      await playPendingCommanderAudio({
        text: message.text || "",
        onProgress: reveal.onProgress,
        onDone: () => {
          reveal.flush();
          setLocalChat((rows) =>
            rows.map((r) =>
              r.id === message.id
                ? {
                    ...r,
                    reveal: (message.text || "").length,
                    speaking: false,
                    voiceEngine: "N1-ryan-natural",
                    needsPlay: false,
                  }
                : r
            )
          );
        },
      });
    }
  }

  const liveAgents = data?.agents || [];
  const byId = Object.fromEntries(liveAgents.map((a) => [a.id, a]));
  // Always show all desk slots (incl. Ghost) even before heartbeat
  const agents = AIM_AGENT_IDS.map((id) => {
    const live = byId[id];
    if (live) return live;
    return {
      id,
      label: aimAgentLabel(id),
      role: aimAgentRole(id),
      identity: aimAgentProfile(id)?.identity || "",
      status: id === "agent6" ? "booting" : "-",
      last_seen_at: null,
    };
  });
  const movements = data?.movements || [];
  const MOVE_PAGE_SIZE = 3;
  const MOVE_HOLD_MS = 1400;
  const movePool = Array.isArray(movements) ? movements.slice(0, 18) : [];
  const movePageCount = Math.max(1, Math.ceil(Math.max(movePool.length, 1) / MOVE_PAGE_SIZE));
  const movePageSafe = movePage % movePageCount;
  const visibleMoves = movePool.slice(
    movePageSafe * MOVE_PAGE_SIZE,
    movePageSafe * MOVE_PAGE_SIZE + MOVE_PAGE_SIZE
  );

  useEffect(() => {
    setMovePage(0);
  }, [movePool.length]);

  useEffect(() => {
    if (movePool.length <= MOVE_PAGE_SIZE) return undefined;
    let fadeTimer = 0;
    const tick = window.setInterval(() => {
      setMoveSwap(true);
      fadeTimer = window.setTimeout(() => {
        setMovePage((p) => (p + 1) % Math.ceil(movePool.length / MOVE_PAGE_SIZE));
        setMoveSwap(false);
      }, 280);
    }, MOVE_HOLD_MS);
    return () => {
      window.clearInterval(tick);
      if (fadeTimer) window.clearTimeout(fadeTimer);
    };
  }, [movePool.length]);

  // Compact mobile desk pulse: one live line per agent, rotate 2 at a time
  const pulsePool = agents.map((a) => {
    const prop = a.proposal || a.meta?.trade_proposal || {};
    const fill = a.last_fill || a.meta?.last_fill || prop?.exec || null;
    let line = prop?.pair
      ? `${prop.pair}${prop.urgency ? ` | ${prop.urgency}` : ""}`
      : (a.meta?.skill?.summary ? String(a.meta.skill.summary).slice(0, 48) : a.status || "watching");
    if (fill?.submitted) {
      line = `Fill ${fill.engine_result || "ok"}${fill.hash ? ` ${String(fill.hash).slice(0, 8)}` : ""}${prop?.pair ? ` | ${prop.pair}` : ""}`;
    } else if (fill?.blocked_by && !fill?.submitted) {
      const reason = fill.blocked_by_display || fill.blocked_by || "gated";
      line = `Held | ${String(reason).slice(0, 42)}`;
    }
    return {
      id: a.id,
      label: a.label || aimAgentLabel(a.id),
      line,
      status: a.status || "-",
    };
  });
  const PULSE_PAGE_SIZE = 2;
  const PULSE_HOLD_MS = 1600;
  const pulsePageCount = Math.max(1, Math.ceil(Math.max(pulsePool.length, 1) / PULSE_PAGE_SIZE));
  const pulsePageSafe = pulsePage % pulsePageCount;
  const visiblePulse = pulsePool.slice(
    pulsePageSafe * PULSE_PAGE_SIZE,
    pulsePageSafe * PULSE_PAGE_SIZE + PULSE_PAGE_SIZE
  );

  useEffect(() => {
    setPulsePage(0);
  }, [pulsePool.length]);

  useEffect(() => {
    if (pulsePool.length <= PULSE_PAGE_SIZE) return undefined;
    let fadeTimer = 0;
    const tick = window.setInterval(() => {
      setPulseSwap(true);
      fadeTimer = window.setTimeout(() => {
        setPulsePage((p) => (p + 1) % Math.ceil(pulsePool.length / PULSE_PAGE_SIZE));
        setPulseSwap(false);
      }, 260);
    }, PULSE_HOLD_MS);
    return () => {
      window.clearInterval(tick);
      if (fadeTimer) window.clearTimeout(fadeTimer);
    };
  }, [pulsePool.length]);

  const deskChartOrders = useMemo(() => {
    const out = [];
    const seen = new Set();
    const push = (row) => {
      if (!row || !(Number(row.price) > 0 || Number(row.iou_per_xrp) > 0 || Number(row.xrp_per_iou) > 0 || Number(row.limit_price) > 0)) return;
      const pair = String(row.pair || "XRP/RLUSD").replace(/\s+/g, "").toUpperCase();
      const key = `${row.agent_id || row.id || "x"}|${pair}|${row.side || ""}|${row.price || row.iou_per_xrp || row.xrp_per_iou || row.limit_price}|${row.status || ""}|${row.submitted ? 1 : 0}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ ...row, pair, key });
    };
    for (const a of data?.desk?.orders || []) push(a);
    for (const a of data?.desk?.agents || []) {
      const prop = a.proposal || a.meta?.trade_proposal || {};
      if (!prop?.action && !prop?.price && !prop?.xrp_per_iou && !prop?.iou_per_xrp && !prop?.limit_price) continue;
      const submitted = !!a.last_fill?.submitted;
      push({
        agent_id: a.id,
        label: a.label || aimAgentLabel(a.id),
        pair: prop.pair || "XRP/RLUSD",
        side: prop.side || prop.limit_side || prop.trade_direction,
        price: prop.price,
        limit_price: prop.limit_price,
        xrp_per_iou: prop.xrp_per_iou,
        iou_per_xrp: prop.iou_per_xrp,
        price_unit: prop.price_unit,
        status: submitted ? "submitted" : prop.executable ? "open" : "proposal",
        submitted,
        open: String(prop.action || "").includes("OfferCreate"),
        urgency: prop.urgency,
        xrp_thesis: prop.xrp_thesis,
        action: prop.action,
        skill_summary: a.skill_summary || a.meta?.skill?.summary,
        tactic: prop.urgency || prop.xrp_thesis || prop.action || a.skill_summary || null,
        playbook: prop.xrp_thesis || a.skill_summary || null,
        t: a.last_fill?.at || a.last_seen_at || null,
      });
      const levels = Array.isArray(a.meta?.open_book_levels) ? a.meta.open_book_levels : [];
      for (const lvl of levels) {
        push({
          agent_id: a.id,
          label: a.label || aimAgentLabel(a.id),
          pair: lvl.pair || prop.pair || "XRP/RLUSD",
          side: lvl.side,
          price: lvl.price,
          iou_per_xrp: lvl.iou_per_xrp,
          xrp_per_iou: lvl.xrp_per_iou,
          price_unit: lvl.price_unit || "quote_per_base",
          status: "open",
          open: true,
          submitted: false,
          action: "OfferCreate",
          tactic: prop.urgency || "open book",
          playbook: prop.xrp_thesis || a.skill_summary || null,
        });
      }
    }
    return out;
  }, [data]);

  const commanderEstimate = data?.commander?.estimate || data?.desk?.estimate || null;

  useEffect(() => {
    if (typeof onChartPropsChange !== "function") return;
    onChartPropsChange({
      deskOrders: deskChartOrders,
      estimate: commanderEstimate,
    });
  }, [deskChartOrders, commanderEstimate, onChartPropsChange]);

  const commanderStatus = data?.commander
    ? `${data.commander.status} | ${ago(data.commander.last_seen_at)}`
    : loading
      ? "Connecting..."
      : "offline";

  return (
    <div className="aim-matrix" onPointerDown={() => { if (voiceOn) unlockCommanderAudio(); }}>
      <div className="aim-matrix-head">
        <div className="aim-matrix-head-main">
          <p className="aim-matrix-kicker">Observe-only | ephemeral chat | no wallets shown</p>
        <div className="aim-matrix-actions">
          <div className="aim-toolbar-item aim-lang">
            <span className="aim-toolbar-kicker">XDX | Language</span>
            <button
              type="button"
              className={`aim-toolbar-btn aim-lang-btn ${langMenuOpen ? "is-open" : ""}`}
              onClick={() => setLangMenuOpen((v) => !v)}
              title="Commander reply + voice language"
              aria-haspopup="listbox"
              aria-expanded={langMenuOpen}
            >
              <span className="aim-lang-btn-value">
                {langPref === "auto"
                  ? `Auto (${suggestedLang}${langSource ? ` | ${langSource}` : ""})`
                  : AIM_LANGUAGES.find((l) => l.code === langPref)?.label || langPref}
              </span>
              <span className="aim-lang-chevron" aria-hidden="true" />
            </button>
            {langMenuOpen ? (
              <div className="aim-lang-menu" role="listbox">
                {AIM_LANGUAGES.map((l) => {
                  const label =
                    l.code === "auto"
                      ? `Auto (${suggestedLang}${langSource ? ` | ${langSource}` : ""})`
                      : l.label;
                  const active = langPref === l.code;
                  return (
                    <button
                      key={l.code}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`aim-lang-option ${active ? "is-active" : ""}`}
                      onClick={() => onLangChange(l.code)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <div className="aim-toolbar-item">
            <span className="aim-toolbar-kicker aim-toolbar-kicker-spacer" aria-hidden="true" />
            <button
              type="button"
              className={`aim-toolbar-btn aim-matrix-voice ${voiceOn ? "is-on" : "is-off"}`}
              onClick={toggleVoice}
              title={voiceOn ? "Mute Commander voice" : "Enable Commander voice"}
            >
              {voiceOn ? "Voice on" : "Voice off"}
            </button>
          </div>
          <div className="aim-toolbar-item">
            <span className="aim-toolbar-kicker aim-toolbar-kicker-spacer" aria-hidden="true" />
            <button
              type="button"
              className="aim-toolbar-btn aim-matrix-refresh"
              onClick={refresh}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>
        </div>
      </div>

      {error ? <p className="aim-matrix-error">{error}</p> : null}

      <section className="aim-chat neon-inset">
        <div className="aim-chat-head">
          <img
            className="aim-commander-avatar"
            src={AIM_COMMANDER_AVATAR}
            alt=""
            title="Commander"
            width={44}
            height={44}
            decoding="async"
          />
          <div className="aim-chat-head-copy">
            <h3>Commander chat</h3>
            <p className="aim-commander-status" title="Commander looping and last seen">
              {commanderStatus}
            </p>
          </div>
        </div>
          <div className="aim-chat-log" ref={chatLogRef}>
            {localChat.map((m, i) => {
              const full = m.text || "";
              // While speaking/pending, typewriter may be mid-word; once idle always show the full reply
              // so bubbles never stay truncated (e.g. cut at "conne").
              const revealed =
                m.speaking || m.pending
                  ? typeof m.reveal === "number"
                    ? full.slice(0, Math.max(0, m.reveal))
                    : full
                  : full;
              const showCaret = m.role === "commander" && (m.speaking || m.pending);
              return (
                <div
                  key={m.id || `local-${i}`}
                  className={`aim-bubble is-${m.role}${m.speaking ? " is-speaking" : ""}${m.pending ? " is-pending" : ""}`}
                >
                  <small>
                    {m.role === "you" ? "You" : m.role === "commander" ? "Commander" : "System"}
                    {m.lang ? ` | ${m.lang}` : ""}
                    {m.voiceEngine ? ` | ${m.voiceEngine}` : ""}
                    {m.speaking ? " | live" : ""}
                  </small>
                  <p>
                    {revealed}
                    {showCaret ? <span className="aim-speak-caret" aria-hidden="true" /> : null}
                  </p>
                  {m.needsPlay ? (
                    <button
                      type="button"
                      className="aim-play-voice"
                      onClick={() => onPlayVoice(m)}
                    >
                      Replay N1 voice
                    </button>
                  ) : null}
                </div>
              );
            })}
            {!localChat.length ? (
              <p className="aim-empty">No chat yet. Ask how the exchange works, or about status, pools, swaps, trust lines, or XRPL context.</p>
            ) : null}
          </div>
          {isAimAdmin ? (
            <p className="aim-admin-teach-hint" style={{ margin: "0 0 6px", fontSize: 12, opacity: 0.85 }}>
              Admin teach on. Start a lesson with Teach ... and Commander will log it with ack.
            </p>
          ) : null}
          <form className="aim-chat-form" ref={chatFormRef} onSubmit={onSend}>
            <input
              ref={chatInputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask Commander (not saved)..."
              maxLength={2000}
            />
            <button type="submit" disabled={!text.trim()} title={busy ? "Stop current reply and send" : "Send"}>
              Send
            </button>
          </form>
      </section>

      {showInlineChart ? (
        <AimDeskSmartChart deskOrders={deskChartOrders} estimate={commanderEstimate} />
      ) : null}

      <div className="aim-agent-strip" role="list">
        {agents.map(
          (agent) => (
            <article
              key={agent.id}
              className="aim-agent-chip"
              role="listitem"
              title={[agent.role || aimAgentRole(agent.id), agent.identity || aimAgentProfile(agent.id)?.identity].filter(Boolean).join(", ")}
            >
              <header>
                <div className="aim-agent-head-left">
                  <AimAgentAvatar agentId={agent.id} />
                  <AimAgentName agentId={agent.id} label={agent.label || aimAgentLabel(agent.id)} stacked />
                </div>
                <span className={`aim-dot is-${String(agent.status || "").toLowerCase()}`} />
              </header>
              {(agent.role || aimAgentRole(agent.id)) ? (
                <p className="aim-agent-role">{agent.role || aimAgentRole(agent.id)}</p>
              ) : null}
              <p>{agent.status || "-"}</p>
              <small>{ago(agent.last_seen_at)}</small>
              {agent.meta?.pools?.pool_count != null ? (
                <small className="aim-meta">Pools {agent.meta.pools.pool_count}</small>
              ) : null}
              {agent.meta?.trade_proposal?.action ? (
                <small className="aim-meta">Desk {agent.meta.trade_proposal.urgency || "proposal"}</small>
              ) : agent.meta?.skill?.summary ? (
                <small className="aim-meta">{String(agent.meta.skill.summary).slice(0, 42)}</small>
              ) : null}
            </article>
          )
        )}
      </div>


      <section className="aim-moves neon-inset" aria-live="polite">
        <div className="aim-moves-head">
          <h3>Recent movement</h3>
          {movePool.length > MOVE_PAGE_SIZE ? (
            <div className="aim-moves-pips" aria-hidden="true">
              {Array.from({ length: movePageCount }).map((_, i) => (
                <i key={i} className={i === movePageSafe ? "is-on" : ""} />
              ))}
            </div>
          ) : null}
        </div>
        <ul className={`aim-moves-list${moveSwap ? " is-swap" : ""}`}>
          {visibleMoves.map((m, idx) => {
            const moveAgentId = m.agent_id || m.from || m.id;
            return (
              <li key={`${m.id || moveAgentId}-${movePageSafe}-${idx}`} style={{ "--aim-move-i": idx }}>
                <div className="aim-row-agent">
                  <AimAgentAvatar agentId={moveAgentId} label={m.label} size="sm" />
                  <b><AimAgentName label={m.label} agentId={moveAgentId} /></b>
                </div>
                <span>{m.summary}</span>
                <small>{ago(m.created_at)}</small>
              </li>
            );
          })}
          {!movePool.length ? <li className="aim-empty">No movement yet.</li> : null}
        </ul>
      </section>

      <section className="aim-desk-pulse neon-inset" aria-live="polite" aria-label="Live desk pulse">
        <div className="aim-moves-head">
          <h3>Live desk</h3>
          {pulsePool.length > PULSE_PAGE_SIZE ? (
            <div className="aim-moves-pips" aria-hidden="true">
              {Array.from({ length: pulsePageCount }).map((_, i) => (
                <i key={i} className={i === pulsePageSafe ? "is-on" : ""} />
              ))}
            </div>
          ) : null}
        </div>
        <p className="aim-desk-pulse-note">Compact mobile feed. Full book on larger screens.</p>
        <ul className={`aim-desk-pulse-list${pulseSwap ? " is-swap" : ""}`}>
          {visiblePulse.map((row, idx) => (
            <li key={`${row.id}-${pulsePageSafe}-${idx}`} style={{ "--aim-move-i": idx }}>
              <div className="aim-row-agent">
                <AimAgentAvatar agentId={row.id} label={row.label} size="sm" />
                <b><AimAgentName agentId={row.id} label={row.label} /></b>
              </div>
              <span>{row.line}</span>
              <small>{row.status}</small>
            </li>
          ))}
          {!pulsePool.length ? <li className="aim-empty">Desk warming up.</li> : null}
        </ul>
      </section>

      <section className="aim-desk-board neon-inset" aria-label="Internal trading desk">
        <div className="aim-desk-head">
          <div>
            <p className="aim-desk-kicker">Internal desk | view only</p>
            <h3>Desk status &amp; book</h3>
            <p className="aim-desk-summary">
              {data?.desk?.summary || "Waiting for AIM workers to publish proposals."}
            </p>
          </div>

        </div>

        <div className="aim-desk-grid">
          <div className="aim-desk-book">
            <h4>Proposal book</h4>
            <ul>
              {(data?.desk?.agents || agents).map((a) => {
                const prop = a.proposal || a.meta?.trade_proposal;
                return (
                  <li key={`desk-${a.id}`}>
                    <header>
                      <div className="aim-row-agent" title={a.role || aimAgentRole(a.id) || undefined}>
                        <AimAgentAvatar agentId={a.id} label={a.label || aimAgentLabel(a.id)} size="sm" />
                        <b><AimAgentName agentId={a.id} label={a.label || aimAgentLabel(a.id) || a.id} /></b>
                      </div>
                      <span className={`aim-urgency is-${String(prop?.urgency || "none").toLowerCase()}`}>
                        {prop?.urgency || "-"}
                      </span>
                    </header>
                    {(a.role || aimAgentRole(a.id)) ? <small className="aim-desk-role">{a.role || aimAgentRole(a.id)}</small> : null}
                    <p>{prop?.action || a.skill_summary || a.meta?.skill?.summary || "No proposal yet"}</p>
                    {prop?.pair ? <small>Pair {prop.pair}</small> : null}
                    {a.usd_mark?.usd_equity != null ? (
                      <small className="aim-desk-usd">
                        USD {Number(a.usd_mark.usd_equity).toFixed(2)}
                        {a.usd_mark.day_start_usd != null ? ` | day×${a.usd_mark.mult_vs_day_start != null ? Number(a.usd_mark.mult_vs_day_start).toFixed(2) : "-"}` : ""}
                        
                      </small>
                    ) : null}
                    {a.last_fill ? (
                      <small className={`aim-desk-fill ${a.last_fill.submitted ? "is-live" : "is-blocked"}`}>
                        {a.last_fill.submitted
                          ? `Fill ${a.last_fill.engine_result || "submitted"} ${a.last_fill.hash ? a.last_fill.hash.slice(0, 8) : ""}`
                          : `${a.last_fill.blocked_by_display || `${a.last_fill.blocked_by_actor_label || "Desk"} blocked: ${a.last_fill.blocked_by || "gate"}`}`}
                      </small>
                    ) : null}
                    {prop?.xrp_thesis ? <small className="aim-desk-thesis">{prop.xrp_thesis}</small> : null}
                    {Array.isArray(prop?.ledger_tools) && prop.ledger_tools.length ? (
                      <small className="aim-desk-tools">Tools {prop.ledger_tools.slice(0, 6).join(" | ")}</small>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="aim-desk-chatter">
            <h4>Agent coordination</h4>
            <p className="aim-desk-note">
              Private desk coordination. Public can watch; they cannot place trades or steer wallets here.
            </p>
            <ul>
              {(data?.desk?.chatter || []).slice().reverse().slice(0, 18).map((m) => (
                <li key={m.id}>
                  <div className="aim-chatter-parties">
                    <span className="aim-row-agent">
                      <AimAgentAvatar agentId={m.from} label={m.from_label || m.from} size="sm" />
                      <b><AimAgentName agentId={m.from} label={m.from_label || m.from} /></b>
                    </span>
                    <span className="aim-chatter-arrow" role="img" aria-label="to"></span>
                    <span className="aim-row-agent">
                      <AimAgentAvatar agentId={m.to} label={m.to_label || m.to} size="sm" />
                      <AimAgentName agentId={m.to} label={m.to_label || m.to} />
                    </span>
                  </div>
                  <p>{m.text}</p>
                  <small>{ago(m.created_at)} | {m.topic}</small>
                </li>
              ))}
              {!(data?.desk?.chatter || []).length ? (
                <li className="aim-empty">No desk messages yet. Redeploy AIM workers to start coordination traffic.</li>
              ) : null}
            </ul>
          </div>
        </div>
      </section>

    </div>
  );
}