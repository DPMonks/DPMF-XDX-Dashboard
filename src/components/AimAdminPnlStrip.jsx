import { useEffect, useState } from "react";
import { getAimAdminPnlRecent, getAimAdminPnlSummary } from "../api/aim";
import { aimAgentLabel, resolveAimAgentId } from "../aimAgentNames";
import {
  AIM_PNL_EMPTY,
  AIM_PNL_POLL_MS,
  fillCountLabel,
  formatLondonStamp,
  formatLondonWindow,
  formatUsd,
  interpretPnlRecent,
  interpretPnlSummary,
  keepPnlOnError,
} from "../aimPnlFormat";
import AimAgentAvatar from "./AimAgentAvatar";

function agentLabel(agent) {
  const id = resolveAimAgentId(agent);
  if (id) return aimAgentLabel(id);
  const text = String(agent || "").trim();
  return text || "Agent";
}

function Who({ agent }) {
  const label = agentLabel(agent);
  return (
    <span className="aim-pnl-who">
      <AimAgentAvatar agentId={agent} label={label} size="sm" />
      <b>{label}</b>
    </span>
  );
}

export default function AimAdminPnlStrip({ wallet, active = true, refreshKey = 0 }) {
  const [tab, setTab] = useState("wins");
  const [recent, setRecent] = useState({ phase: "loading", trades: [], note: "" });
  const [summary, setSummary] = useState({ phase: "loading", summary: null, note: "" });

  useEffect(() => {
    if (!active || !wallet) return undefined;
    let cancelled = false;

    async function load() {
      const [recentRes, summaryRes] = await Promise.allSettled([
        getAimAdminPnlRecent(wallet),
        getAimAdminPnlSummary(wallet),
      ]);
      if (cancelled) return;
      if (recentRes.status === "fulfilled") setRecent(interpretPnlRecent(recentRes.value));
      else setRecent((prev) => keepPnlOnError(prev, recentRes.reason));
      if (summaryRes.status === "fulfilled") setSummary(interpretPnlSummary(summaryRes.value));
      else setSummary((prev) => keepPnlOnError(prev, summaryRes.reason));
    }

    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      load();
    }, AIM_PNL_POLL_MS);
    function onVis() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [active, wallet, refreshKey]);

  const winsReady = recent.phase === "ready";
  const dayReady = summary.phase === "ready" && summary.summary;
  const day = summary.summary;
  const windowLabel = day ? formatLondonWindow(day.window_start, day.window_end) : "";
  const updated = formatLondonStamp((tab === "wins" ? recent.updatedAt : summary.updatedAt) || "");

  return (
    <section className="aim-pnl neon-inset" aria-label="Admin team profit">
      <div className="aim-pnl-head">
        <p className="aim-desk-kicker">Admin ledger</p>
        <h3>Team profit</h3>
      </div>
      <div className="aim-pnl-tabs" role="tablist" aria-label="Team profit views">
        <button
          type="button"
          role="tab"
          id="aim-pnl-tab-wins"
          className={`aim-pnl-tab${tab === "wins" ? " is-on" : ""}`}
          aria-selected={tab === "wins"}
          aria-controls="aim-pnl-panel-wins"
          onClick={() => setTab("wins")}
        >
          Wins
        </button>
        <button
          type="button"
          role="tab"
          id="aim-pnl-tab-day"
          className={`aim-pnl-tab${tab === "day" ? " is-on" : ""}`}
          aria-selected={tab === "day"}
          aria-controls="aim-pnl-panel-day"
          onClick={() => setTab("day")}
        >
          24h
        </button>
      </div>

      {tab === "wins" ? (
        <div role="tabpanel" id="aim-pnl-panel-wins" aria-labelledby="aim-pnl-tab-wins">
          {recent.phase === "loading" ? <p className="aim-empty">Loading team profit...</p> : null}
          {winsReady && recent.trades.length ? (
            <ul className="aim-pnl-list">
              {recent.trades.map((row) => (
                <li key={row.id}>
                  <div className="aim-pnl-row-top">
                    <Who agent={row.agent} />
                    <span className="aim-pnl-amount">{formatUsd(row.realized_pnl_usd)}</span>
                  </div>
                  <p className="aim-pnl-pair">{row.pair || "Pair n/a"}</p>
                  <small>
                    {formatLondonStamp(row.created_at) || "Time n/a"}
                    {row.tx_hash ? ` | ${row.tx_hash.slice(0, 8)}` : ""}
                  </small>
                </li>
              ))}
            </ul>
          ) : null}
          {recent.phase !== "loading" && !recent.trades.length ? (
            <p className="aim-empty">{recent.note || AIM_PNL_EMPTY}</p>
          ) : null}
          {recent.staleNote ? <p className="aim-pnl-stale">{recent.staleNote}</p> : null}
        </div>
      ) : (
        <div role="tabpanel" id="aim-pnl-panel-day" aria-labelledby="aim-pnl-tab-day">
          {summary.phase === "loading" ? <p className="aim-empty">Loading team profit...</p> : null}
          {dayReady ? (
            <>
              <p className="aim-pnl-total" aria-live="polite">
                {formatUsd(day.total_earned_usd)}
              </p>
              <p className="aim-pnl-meta">{fillCountLabel(day.trade_count) || "Team total, last 24 hours"}</p>
              {windowLabel ? <p className="aim-pnl-window">{windowLabel}</p> : null}
              {day.by_agent?.length ? (
                <ul className="aim-pnl-agents" aria-label="Earnings by agent">
                  {day.by_agent.map((row) => (
                    <li key={row.agent || row.realized_pnl_usd}>
                      <Who agent={row.agent} />
                      <span className="aim-pnl-amount">{formatUsd(row.realized_pnl_usd)}</span>
                      {row.trade_count != null ? <small>{fillCountLabel(row.trade_count)}</small> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {day.trade_count === 0 || (day.trade_count == null && !(Number(day.total_earned_usd) > 0)) ? (
                <p className="aim-empty">{AIM_PNL_EMPTY}</p>
              ) : null}
            </>
          ) : null}
          {summary.phase !== "loading" && !dayReady ? (
            <p className="aim-empty">{summary.note || AIM_PNL_EMPTY}</p>
          ) : null}
          {summary.staleNote ? <p className="aim-pnl-stale">{summary.staleNote}</p> : null}
        </div>
      )}
      {updated ? <p className="aim-pnl-updated">Updated {updated}</p> : null}
    </section>
  );
}
