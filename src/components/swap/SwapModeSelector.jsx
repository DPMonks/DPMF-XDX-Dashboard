import { feeBadgeForMode } from "../../swap/swapFeeCalculator.js";
import { SWAP_MODES, normalizeSwapMode } from "../../swap/swapModes.js";

export default function SwapModeSelector({ value, onChange }) {
  const current = normalizeSwapMode(value);
  return (
    <div className="xdx-swap-mode-list" role="radiogroup" aria-label="Swap options">
      {SWAP_MODES.map((mode) => {
        const on = current === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            className={on ? "is-on" : ""}
            aria-checked={on}
            title={mode.user}
            onClick={() => onChange(mode.id)}
          >
            <span className="xdx-swap-radio-mark" aria-hidden="true" />
            <span className="xdx-swap-radio-copy">
              <b>
                {mode.title}
                {mode.recommended ? <em>Recommended</em> : null}
              </b>
              <small>{mode.short}</small>
            </span>
            <span className="xdx-swap-fee-badge">{feeBadgeForMode(mode.id)}</span>
          </button>
        );
      })}
    </div>
  );
}
