import { useCallback, useEffect, useRef, useState } from "react";
import { getAimStatus, postAimChat, getAimLocale } from "../api/aim";
import { AIM_LANGUAGES, normalizeLang, readLangPref, writeLangPref } from "../aimLocale";
import { aimVoiceEngineLabel, playPendingCommanderAudio, readVoicePref, speakCommander, stopCommanderSpeech, unlockCommanderAudio, writeVoicePref } from "../aimCommanderVoice";
import { AIM_AGENT_IDS, AIM_COMMANDER_AVATAR, aimAgentLabel, aimAgentRole, aimAgentProfile } from "../aimAgentNames";
import AimAgentName from "./AimAgentName";
import AimAgentAvatar from "./AimAgentAvatar";
import { useWallet } from "../context/useWallet";

function ago(iso) {
  if (!iso) return "-";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "-";
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return `${Math.round(sec / 3600)}h ago`;
}

export default function AiMatrixPanel() {
  const { walletAddress } = useWallet();
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
      ...finishSpeakingRows(rows),
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
      const out = await postAimChat(message, {
        lang: langPref === "auto" ? "auto" : effectiveLang,
        wallet: walletAddress || null,
      });
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

  const commanderStatus = data?.commander
    ? `${data.commander.status} · ${ago(data.commander.last_seen_at)}`
    : loading
      ? "Connecting…"
      : "offline";

  return (
    <div className="aim-matrix" onPointerDown={() => { if (voiceOn) unlockCommanderAudio(); }}>
      <div className="aim-matrix-head">
        <div className="aim-matrix-head-main">
          <p className="aim-matrix-kicker">Observe-only · ephemeral chat · no wallets shown</p>
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


      <section className="aim-moves neon-inset">
        <h3>Recent movement</h3>
        <ul>
          {movements.slice(0, 16).map((m) => {
            const moveAgentId = m.agent_id || m.from || m.id;
            return (
              <li key={m.id}>
                <div className="aim-row-agent">
                  <AimAgentAvatar agentId={moveAgentId} label={m.label} size="sm" />
                  <b><AimAgentName label={m.label} agentId={moveAgentId} /></b>
                </div>
                <span>{m.summary}</span>
                <small>{ago(m.created_at)}</small>
              </li>
            );
          })}
          {!movements.length ? <li className="aim-empty">No movement yet.</li> : null}
        </ul>
      </section>

      <section className="aim-desk-board neon-inset" aria-label="Internal trading desk">
        <div className="aim-desk-head">
          <div>
            <p className="aim-desk-kicker">Internal desk · view only</p>
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
                        {a.usd_mark.day_start_usd != null ? ` · day×${a.usd_mark.mult_vs_day_start != null ? Number(a.usd_mark.mult_vs_day_start).toFixed(2) : "-"}` : ""}
                        
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
                    <span className="aim-chatter-arrow" aria-hidden="true">→</span>
                    <span className="aim-row-agent">
                      <AimAgentAvatar agentId={m.to} label={m.to_label || m.to} size="sm" />
                      <AimAgentName agentId={m.to} label={m.to_label || m.to} />
                    </span>
                  </div>
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

    </div>
  );
}