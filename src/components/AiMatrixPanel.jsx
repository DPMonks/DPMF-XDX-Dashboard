import { useCallback, useEffect, useState } from "react";
import { getAimStatus, postAimChat, getAimLocale } from "../api/aim";
import { AIM_LANGUAGES, normalizeLang, readLangPref, writeLangPref } from "../aimLocale";
import { readVoicePref, speakCommander, stopCommanderSpeech, writeVoicePref } from "../aimCommanderVoice";

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
      return next;
    });
  }

  function onLangChange(event) {
    const next = event.target.value || "auto";
    setLangPref(next);
    writeLangPref(next);
  }

  async function onSend(event) {
    event.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setLocalChat((rows) => [...rows, { role: "you", text: message, at: new Date().toISOString() }]);
    setText("");
    try {
      const out = await postAimChat(message, { lang: langPref === "auto" ? "auto" : effectiveLang });
      const reply = out.reply?.body?.text || "Queued.";
      const replyLang = out.lang || effectiveLang;
      setLocalChat((rows) => [...rows, { role: "commander", text: reply, at: new Date().toISOString(), lang: replyLang }]);
      await speakCommander(reply, { voiceOn, lang: replyLang });
      await refresh();
    } catch (err) {
      setLocalChat((rows) => [
        ...rows,
        { role: "system", text: err.message || "Chat failed", at: new Date().toISOString() },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const agents = data?.agents || [];
  const movements = data?.movements || [];

  return (
    <div className="aim-matrix">
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
          <label className="aim-lang">
            <span>Language</span>
            <select value={langPref} onChange={onLangChange} title="Commander reply + voice language">
              {AIM_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.code === "auto" ? `Auto (${suggestedLang}${langSource ? ` · ${langSource}` : ""})` : l.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`aim-matrix-voice ${voiceOn ? "is-on" : "is-off"}`}
            onClick={toggleVoice}
            title={voiceOn ? "Mute Commander voice" : "Enable Commander voice"}
          >
            {voiceOn ? "Voice on" : "Voice off"}
          </button>
          <button type="button" className="aim-matrix-refresh" onClick={refresh} disabled={loading}>
            Refresh
          </button>
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
            </article>
          )
        )}
      </div>

      <div className="aim-matrix-grid">
        <section className="aim-chat neon-inset">
          <h3>Commander chat</h3>
          <div className="aim-chat-log">
            {localChat.map((m, i) => (
              <div key={`local-${i}`} className={`aim-bubble is-${m.role}`}>
                <small>
                  {m.role === "you" ? "You" : m.role === "commander" ? "Commander" : "System"}
                  {m.lang ? ` · ${m.lang}` : ""}
                </small>
                <p>{m.text}</p>
              </div>
            ))}
            {!localChat.length ? (
              <p className="aim-empty">No chat yet. Ask about status, pools, XRPL txs, or market context.</p>
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
