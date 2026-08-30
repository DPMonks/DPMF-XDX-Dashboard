import { memo, useState } from "react";
import { useI18n } from "../i18n/useI18n";
import DexChart from "./DexChart";
import HybridChart from "./HybridChart";

function TradingChart({ lockedPair } = {}) {
  const { t } = useI18n();
  const [mode, setMode] = useState("hybrid");

  return (
    <div className="trading-chart">
      <div className="hybrid-mode-switch">
        <button
          type="button"
          className={mode === "hybrid" ? "pair-chip active" : "pair-chip"}
          onClick={() => setMode("hybrid")}
        >
          {t.hybridChart}
        </button>
        <button
          type="button"
          className={mode === "dexscreener" ? "pair-chip active" : "pair-chip"}
          onClick={() => setMode("dexscreener")}
        >
          Dexscreener
        </button>
      </div>
      {mode === "hybrid" ? <HybridChart lockedPair={lockedPair} /> : <DexChart />}
    </div>
  );
}

export default memo(TradingChart);
