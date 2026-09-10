import { useCallback, useEffect, useRef, useState } from "react";
import { getAimStatus, postAimChat, getAimLocale } from "../api/aim";
import { AIM_LANGUAGES, normalizeLang, readLangPref, writeLangPref } from "../aimLocale";
import { aimVoiceEngineLabel, playPendingCommanderAudio, readVoicePref, speakCommander, stopCommanderSpeech, unlockCommanderAudio, writeVoicePref } from "../aimCommanderVoice";

function ago(iso) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return `${Math.round(sec / 3600)}h ago`;
}

export default function AiMatrixPanel() {
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

  function toggleVoice() {
    setVoiceOn((prev) => {
      const next = !prev;
      writeVoicePref(next);
      if (!next) stopCommanderSpeech();
      else unlockCommanderAudio();
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

  // Keep the chat log pinned to the newest line while conversation flows / types.
  useEffect(() => {
    const el = chatLogRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [localChat]);

  async function onSend(event) {
    event.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    if (voiceOn) {
      unlockCommanderAudio();
      try { window.speechSynthesis?.resume?.(); } catch { /* ignore */ }
    }
    const thinkingId = `thinking-${Date.now()}`;
    setLocalChat((rows) => [
      ...rows,
      { role: "you", text: message, at: new Date().toISOString() },
      {
        id: thinkingId,
        role: "commander",
        text: "Composing…",
        at: new Date().toISOString(),
        pending: true,
        reveal: 11,
      },
    ]);
    setText("");
    try {
      const out = await postAimChat(message, { lang: langPref === "auto" ? "auto" : effectiveLang });
      const reply = out.reply?.body?.text || "Queued.";
      const replyLang = out.lang || effectiveLang;
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
      const spoken = await speakCommander(reply, {
        voiceOn,
        lang: replyLang,
        onProgress: ({ chars }) => {
          setLocalChat((rows) =>
            rows.map((r) => (r.id === replyId ? { ...r, reveal: chars, speaking: true } : r))
          );
        },
        onDone: () => {
          setLocalChat((rows) =>
            rows.map((r) =>
              r.id === replyId ? { ...r, reveal: reply.length, speaking: false } : r
            )
          );
        },
      });
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
      await refresh();
    } catch (err) {
      setLocalChat((rows) => [
        ...rows.filter((r) => r.id !== thinkingId),
        { role: "system", text: err.message || "Chat failed", at: new Date().toISOString() },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function onPlayVoice(message) {
    if (!message?.id) return;
    unlockCommanderAudio();
    setLocalChat((rows) =>
      rows.map((r) => (r.id === message.id ? { ...r, speaking: true, needsPlay: false } : r))
    );
    await playPendingCommanderAudio({
      text: message.text || "",
      onProgress: ({ chars }) => {
        setLocalChat((rows) =>
          rows.map((r) => (r.id === message.id ? { ...r, reveal: chars, speaking: true } : r))
        );
      },
      onDone: () => {
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

  const agents = data?.agents || [];
  const movements = data?.movements || [];

  return (
    <div className="aim-matrix" onPointerDown={() => { if (voiceOn) unlockCommanderAudio(); }}>
      <div className="aim-matrix-head">
        <div>
          <p className="aim-matrix-kicker">Observe-only · ephemeral chat · no wallets shown</p>
          <p className="aim-matrix-commander">
            {data?.commander
              ? `Commander · ${data.commander.status} · ${ago(data.commander.last_seen_at)}`
              : loading
                ? "Connecting to Commander…"
                : "Commander offline"}
          </p>
        </div>
        <div className="aim-matrix-actions">
          <div className="aim-toolbar-item aim-lang">
            <span className="aim-toolbar-kicker">XDX · Language</span>
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
                  ? `Auto (${suggestedLang}${langSource ? ` · ${langSource}` : ""})`
                  : AIM_LANGUAGES.find((l) => l.code === langPref)?.label || langPref}
              </span>
              <span className="aim-lang-chevron" aria-hidden="true" />
            </button>
            {langMenuOpen ? (
              <div className="aim-lang-menu" role="listbox">
                {AIM_LANGUAGES.map((l) => {
                  const label =
                    l.code === "auto"
                      ? `Auto (${suggestedLang}${langSource ? ` · ${langSource}` : ""})`
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

      {error ? <p className="aim-matrix-error">{error}</p> : null}

      <div className="aim-agent-strip" role="list">
        {(agents.length ? agents : [1, 2, 3, 4, 5].map((n) => ({ id: `agent${n}`, label: `Agent ${n}`, status: "—" }))).map(
          (agent) => (
            <article key={agent.id} className="aim-agent-chip" role="listitem">
              <header>
                <b>{agent.label}</b>
                <span className={`aim-dot is-${String(agent.status || "").toLowerCase()}`} />
              </header>
              <p>{agent.status || "—"}</p>
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


      <section className="aim-desk-board neon-inset" aria-label="Internal trading desk">
        <div className="aim-desk-head">
          <div>
            <p className="aim-desk-kicker">Internal desk · view only</p>
            <h3>Desk status &amp; book</h3>
            <p className="aim-desk-summary">
              {data?.desk?.summary || "Waiting for AIM workers to publish proposals."}
            </p>
          </div>
          <div className="aim-desk-badges">
            <span className="aim-desk-badge">Phase {data?.desk?.phase || "A"}</span>
            <span className="aim-desk-badge">Objective: daily USD growth / wallet</span>
            <span className="aim-desk-badge">Target: mainnet</span>
            <span className="aim-desk-badge is-safe">No public trade controls</span>
            <span className="aim-desk-badge is-safe">No freeze / blackhole</span>
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
                      <b>{a.label || a.id}</b>
                      <span className={`aim-urgency is-${String(prop?.urgency || "none").toLowerCase()}`}>
                        {prop?.urgency || "—"}
                      </span>
                    </header>
                    <p>{prop?.action || a.skill_summary || a.meta?.skill?.summary || "No proposal yet"}</p>
                    {prop?.pair ? <small>Pair {prop.pair}</small> : null}
                    {prop?.xrp_thesis ? <small className="aim-desk-thesis">{prop.xrp_thesis}</small> : null}
                    {Array.isArray(prop?.ledger_tools) && prop.ledger_tools.length ? (
                      <small className="aim-desk-tools">Tools {prop.ledger_tools.slice(0, 6).join(" · ")}</small>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="aim-desk-chatter">
            <h4>Agent coordination</h4>
            <p className="aim-desk-note">
              Private desk chatter about growing each wallet's USD value by end of day. Public can watch; they cannot place trades or steer wallets here.
            </p>
            <ul>
              {(data?.desk?.chatter || []).slice().reverse().slice(0, 18).map((m) => (
                <li key={m.id}>
                  <b>{m.from}</b>
                  <span>→ {m.to}</span>
                  <p>{m.text}</p>
                  <small>{ago(m.created_at)} · {m.topic}</small>
                </li>
              ))}
              {!(data?.desk?.chatter || []).length ? (
                <li className="aim-empty">No desk messages yet. Redeploy AIM workers to start coordination traffic.</li>
              ) : null}
            </ul>
          </div>
        </div>
      </section>

      <div className="aim-matrix-grid">
        <section className="aim-chat neon-inset">
          <h3>Commander chat</h3>
          <div className="aim-chat-log" ref={chatLogRef}>
            {localChat.map((m, i) => {
              const full = m.text || "";
              const revealed =
                typeof m.reveal === "number" ? full.slice(0, Math.max(0, m.reveal)) : full;
              const showCaret = m.role === "commander" && (m.speaking || m.pending);
              return (
                <div
                  key={m.id || `local-${i}`}
                  className={`aim-bubble is-${m.role}${m.speaking ? " is-speaking" : ""}${m.pending ? " is-pending" : ""}`}
                >
                  <small>
                    {m.role === "you" ? "You" : m.role === "commander" ? "Commander" : "System"}
                    {m.lang ? ` · ${m.lang}` : ""}
                    {m.voiceEngine ? ` · ${m.voiceEngine}` : ""}
                    {m.speaking ? " · live" : ""}
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
          <form className="aim-chat-form" onSubmit={onSend}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask Commander (not saved)…"
              maxLength={2000}
              disabled={busy}
            />
            <button type="submit" disabled={busy || !text.trim()}>
              Send
            </button>
          </form>
        </section>

        <section className="aim-moves neon-inset">
          <h3>Recent movement</h3>
          <ul>
            {movements.slice(0, 16).map((m) => (
              <li key={m.id}>
                <b>{m.label}</b>
                <span>{m.summary}</span>
                <small>{ago(m.created_at)}</small>
              </li>
            ))}
            {!movements.length ? <li className="aim-empty">No movement yet.</li> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
