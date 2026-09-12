import { memo, useState } from "react";
import { useI18n } from "../i18n/useI18n";
import DexChart from "./DexChart";
import HybridChart from "./HybridChart";

export {
  AIM_DESK_AGENT_COLORS,
  asciiClean,
  buildDeskMarks,
  buildEstimateMarks,
  classifyDeskMarkStyle,
  coerceQuotePerBase,
  deskMarkAskPrompt,
  deskMarkColor,
  deskMarkDotRadius,
  deskMarkPaintColor,
  deskMarkTouchClusterFlags,
  DESK_CLUSTER_PURPLE,
  DESK_CLUSTER_TOOLTIP,
  inQuotePerBaseBand,
  normalizeDeskSide,
  quotePerBaseFromDeskOrder,
} from "../chart/aimMarks";

/**
 * Shared AIM chart: full HybridChart (pairs, Hybrid/Dex modes, tools, TFs)
 * plus desk OfferCreates and Commander estimate markers.
 * Bullish/Bearish scenario UI and auto analysis speak are disabled.
 */
function AimDeskSmartChart({
  deskOrders = [],
  estimate = null,
  fillHeight = false,
  showModeSwitch = true,
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState("hybrid");

  return (
    <section
      className={`aim-merged-chart neon-inset${fillHeight ? " is-fill" : ""}`}
      aria-label="Shared trading chart"
    >
      <div className="aim-merged-chart-head">
        <div>
          <p className="aim-merged-chart-kicker">Shared chart | Hybrid + AIM desk</p>
          <h3>Trading chart</h3>
          <p className="aim-merged-chart-sub">
            Pair tabs, Hybrid/Dexscreener, Candles or AMM channel, MA/SMA, hollow candles, arbitrage,
            volume wave, RSI, drawings, timeframes, CEX tape for XRP/RLUSD. Public book + desk
            fills/offers for the active pair (click a mark to ask Commander). Estimate markers only
            (no Bullish/Bearish analysis UI).
          </p>
        </div>
        {showModeSwitch ? (
          <div className="hybrid-mode-switch aim-merged-mode">
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
        ) : null}
      </div>
      {mode === "hybrid" ? (
        <HybridChart
          deskOrders={deskOrders}
          estimate={estimate}
          aimEmbed={fillHeight}
          initialPair="XRP/RLUSD"
        />
      ) : (
        <DexChart />
      )}
    </section>
  );
}

export default memo(AimDeskSmartChart);
