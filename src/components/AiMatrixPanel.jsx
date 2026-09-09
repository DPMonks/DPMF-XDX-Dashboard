import { useCallback, useEffect, useState } from "react";
import { getAimStatus, postAimChat } from "../api/aim";

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
    return () => window.clearInterval(id);
  }, [refresh]);

  async function onSend(event) {
    event.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setLocalChat((rows) => [...rows, { role: "you", text: message, at: new Date().toISOString() }]);
    setText("");
    try {
      const out = await postAimChat(message);
      const reply = out.reply?.body?.text || "Queued.";
      setLocalChat((rows) => [...rows, { role: "commander", text: reply, at: new Date().toISOString() }]);
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
  const busChat = (data?.messages || []).filter((m) => m.topic === "chat");

  return (
    <div className="aim-matrix">
      <div className="aim-matrix-head">
        <div>
          <p className="aim-matrix-kicker">Observe-only · no wallets shown</p>
          <p className="aim-matrix-commander">
            {data?.commander
              ? `Commander · ${data.commander.status} · ${ago(data.commander.last_seen_at)}`
              : loading
                ? "Connecting to Commander…"
                : "Commander offline"}
          </p>
        </div>
        <button type="button" className="aim-matrix-refresh" onClick={refresh} disabled={loading}>
          Refresh
        </button>
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
            {busChat.map((m) => (
              <div key={`bus-${m.id}`} className={`aim-bubble is-${m.from === "dashboard" ? "you" : "commander"}`}>
                <small>{m.from_label || m.from}</small>
                <p>{m.body?.text || m.body?.instruction || JSON.stringify(m.body)}</p>
              </div>
            ))}
            {localChat.map((m, i) => (
              <div key={`local-${i}`} className={`aim-bubble is-${m.role}`}>
                <small>{m.role === "you" ? "You" : m.role === "commander" ? "Commander" : "System"}</small>
                <p>{m.text}</p>
              </div>
            ))}
            {!busChat.length && !localChat.length ? <p className="aim-empty">No chat yet. Ask Commander for status.</p> : null}
          </div>
          <form className="aim-chat-form" onSubmit={onSend}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message Commander…"
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
