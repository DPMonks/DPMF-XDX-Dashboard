import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n/useI18n";

function noticeFromEvent(kind, detail) {
  const body = detail && typeof detail === "object" ? detail : {};
  return { kind, ...body };
}

function titleFor(t, notice) {
  if (notice.kind === "failed") return t.tradeFailed;
  if (notice.kind === "unconfirmed") return t.tradeUnconfirmed;
  const type = notice.txjson?.TransactionType;
  if (type === "AMMWithdraw") return t.lpRemoved;
  if (type === "AMMDeposit") return t.lpAdded;
  if (type === "AMMCreate") return t.createPoolExecuted;
  if (type === "AMMVote") return t.voteExecuted;
  return t.tradeExecuted;
}

function hintFor(t, notice) {
  if (notice.kind === "failed") {
    const code = notice.engineResult ? ` ${notice.engineResult}.` : "";
    return `${t.tradeFailedHint}${code}`;
  }
  if (notice.kind === "unconfirmed") return t.tradeUnconfirmedHint;
  const type = notice.txjson?.TransactionType;
  if (type === "AMMWithdraw") return t.lpRemovedHint;
  if (type === "AMMDeposit") return t.lpAddedHint;
  if (type === "AMMCreate") return t.createPoolExecutedHint;
  if (type === "AMMVote") return t.voteExecutedHint;
  return t.tradeExecutedHint;
}

export default function TradeExecuted() {
  const { t } = useI18n();
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    function onDone(event) {
      setDetail(noticeFromEvent("executed", event.detail));
    }
    function onFailed(event) {
      setDetail(noticeFromEvent("failed", event.detail));
    }
    function onUnconfirmed(event) {
      setDetail(noticeFromEvent("unconfirmed", event.detail));
    }
    window.addEventListener("dpmf-trade-executed", onDone);
    window.addEventListener("dpmf-trade-failed", onFailed);
    window.addEventListener("dpmf-trade-unconfirmed", onUnconfirmed);
    return () => {
      window.removeEventListener("dpmf-trade-executed", onDone);
      window.removeEventListener("dpmf-trade-failed", onFailed);
      window.removeEventListener("dpmf-trade-unconfirmed", onUnconfirmed);
    };
  }, []);

  useEffect(() => {
    if (!detail) return undefined;
    const timer = window.setTimeout(() => setDetail(null), 7000);
    return () => window.clearTimeout(timer);
  }, [detail]);

  if (!detail) return null;

  const hash = detail.txid ? `${String(detail.txid).slice(0, 8)}…${String(detail.txid).slice(-6)}` : "";
  const tone = detail.kind === "failed" ? "is-failed" : detail.kind === "unconfirmed" ? "is-unconfirmed" : "is-ok";

  return createPortal(
    <div
      className="wallet-modal-overlay trade-executed-overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) setDetail(null);
      }}
    >
      <div
        className={`wallet-modal trade-executed-modal ${tone}`}
        role="alertdialog"
        aria-labelledby="trade-executed-title"
      >
        <h2 id="trade-executed-title" className="modal-title">
          {titleFor(t, detail)}
        </h2>
        <p className="trade-executed-copy">{hintFor(t, detail)}</p>
        {hash ? <p className="trade-executed-hash">{hash}</p> : null}
        <button type="button" className="connect-wallet-btn" onClick={() => setDetail(null)}>
          {t.ok || t.cancel}
        </button>
      </div>
    </div>,
    document.body
  );
}
