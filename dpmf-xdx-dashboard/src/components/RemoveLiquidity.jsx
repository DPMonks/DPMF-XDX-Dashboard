import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { useRemoveLiquidity } from "../hooks/useRemoveLiquidity";

export default function RemoveLiquidity() {
  const { walletAddress } = useWallet();
  const { removeLiquidity, loading, payloadUrl } = useRemoveLiquidity();

  const [poolId, setPoolId] = useState("");
  const [amount, setAmount] = useState("");

  function submit() {
    removeLiquidity({
      walletAddress,
      poolId,
      amount
    });
  }

  if (!walletAddress) return <p>Connect wallet to remove liquidity.</p>;

  return (
    <div>
      <h2>Remove Liquidity</h2>

      <div className="balance-row">
        <span>Pool ID</span>
        <input
          type="text"
          value={poolId}
          onChange={(e) => setPoolId(e.target.value)}
        />
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
