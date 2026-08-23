import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n/useI18n";

export default function TradeExecuted() {
  const { t } = useI18n();
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    function onDone(event) {
      setDetail(event.detail && typeof event.detail === "object" ? event.detail : {});
    }
    window.addEventListener("dpmf-trade-executed", onDone);
    return () => window.removeEventListener("dpmf-trade-executed", onDone);
  }, []);

  useEffect(() => {
    if (!detail) return undefined;
    const timer = window.setTimeout(() => setDetail(null), 7000);
    return () => window.clearTimeout(timer);
  }, [detail]);

  if (!detail) return null;

  const hash = detail.txid ? `${String(detail.txid).slice(0, 8)}…${String(detail.txid).slice(-6)}` : "";

  return createPortal(
    <div
      className="wallet-modal-overlay trade-executed-overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) setDetail(null);
      }}
    >
      <div className="wallet-modal trade-executed-modal" role="alertdialog" aria-labelledby="trade-executed-title">
        <h2 id="trade-executed-title" className="modal-title">
          {t.tradeExecuted}
        </h2>
        <p className="trade-executed-copy">{t.tradeExecutedHint}</p>
        {hash ? <p className="trade-executed-hash">{hash}</p> : null}
        <button type="button" className="connect-wallet-btn" onClick={() => setDetail(null)}>
          {t.ok || t.cancel}
        </button>
      </div>
    </div>,
    document.body
  );
}
