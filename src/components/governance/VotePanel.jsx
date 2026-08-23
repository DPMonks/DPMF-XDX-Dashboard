import { useState } from "react";
import { formatFeePercent, feeUnitsFromPercent } from "../../wallet/ammVote";

export default function VotePanel({
  fee,
  onFee,
  eligible,
  signedIn,
  confirming,
  onAskConfirm,
  onCancelConfirm,
  onSign,
  pair,
  locale,
  t,
}) {
  const [hint, setHint] = useState(false);
  const units = feeUnitsFromPercent(fee);

  return (
    <section className="governance-vote">
      <div className="governance-vote-head">
        <label htmlFor="governance-fee">
          {t.proposedFee}
          <b>{formatFeePercent(fee, locale)}</b>
        </label>
        <button
          type="button"
          className="governance-tip"
          title={t.voteWeightHint}
          onClick={() => setHint((open) => !open)}
        >
          i
        </button>
      </div>
      {hint ? <p className="governance-tip-copy">{t.voteWeightHint}</p> : null}
      <input
        id="governance-fee"
        type="range"
        min="0"
        max="1"
        step="0.001"
        value={fee}
        disabled={!eligible}
        onChange={(event) => onFee(Number(event.target.value))}
      />
      <p className="governance-units">{units} / 1000</p>
      {confirming ? (
        <div className="governance-confirm">
          <p>
            {t.voteConfirmHint
              .replace("{pair}", pair)
              .replace("{fee}", formatFeePercent(fee, locale))}
          </p>
          <div className="governance-actions">
            <button type="button" className="connect-wallet-btn" onClick={onSign}>
              {t.signVote}
            </button>
            <button type="button" className="cancel-wallet-btn" onClick={onCancelConfirm}>
              {t.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="governance-actions">
          <button
            type="button"
            className="connect-wallet-btn"
            disabled={!signedIn ? false : !eligible}
            onClick={onAskConfirm}
          >
            {signedIn ? t.confirmVote : t.connectWallet}
          </button>
        </div>
      )}
      <p className="governance-withdraw-note">{t.voteCannotWithdraw}</p>
    </section>
  );
}
