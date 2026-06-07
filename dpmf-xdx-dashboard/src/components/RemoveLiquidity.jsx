import { useState } from "react";
import { useWalletContext } from "../context/WalletContext";
import { useRemoveLiquidity } from "../hooks/useRemoveLiquidity";

export default function RemoveLiquidity({ lpTokens }) {
  const { account } = useWalletContext();
  const { removeLiquidity, loading, payloadUrl } = useRemoveLiquidity();

  const [selectedLp, setSelectedLp] = useState(null);
  const [amount, setAmount] = useState("");

  function submit() {
    if (!selectedLp) return;

    removeLiquidity({
      account,
      lpToken: selectedLp,
      amount
    });
  }

  if (!account) return <p>Connect wallet to remove liquidity.</p>;

  return (
    <div>
      <h2>Remove Liquidity</h2>

      <div className="balance-row">
        <span>Select LP Token</span>
        <select
          onChange={(e) => {
            const lp = lpTokens.find((t) => t.currency === e.target.value);
            setSelectedLp(lp);
          }}
        >
          <option value="">Select LP</option>
          {lpTokens.map((lp, i) => (
            <option key={i} value={lp.currency}>
              {lp.currency}
            </option>
          ))}
        </select>
      </div>

      <div className="balance-row">
        <span>Amount</span>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <button className="connect-wallet-btn" onClick={submit} disabled={loading}>
        {loading ? "Preparing XUMM..." : "Remove Liquidity"}
      </button>

      {payloadUrl && (
        <p>
          Sign in XUMM:{" "}
          <a href={payloadUrl} target="_blank">
            Open XUMM
          </a>
        </p>
      )}
    </div>
  );
}
