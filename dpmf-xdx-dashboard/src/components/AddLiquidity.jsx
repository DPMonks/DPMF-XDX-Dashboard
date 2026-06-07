import { useState } from "react";
import { useWalletContext } from "../context/WalletContext";
import { useAddLiquidity } from "../hooks/useAddLiquidity";

export default function AddLiquidity() {
  const { account } = useWalletContext();
  const { addLiquidity, loading, payloadUrl } = useAddLiquidity();

  const [tokenA, setTokenA] = useState("XDX");
  const [tokenB, setTokenB] = useState("XRP");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");

  function submit() {
    addLiquidity({
      account,
      tokenA,
      tokenB,
      amountA,
      amountB
    });
  }

  if (!account) return <p>Connect wallet to add liquidity.</p>;

  return (
    <div>
      <h2>Add Liquidity</h2>

      <div className="balance-row">
        <span>Token A</span>
        <select value={tokenA} onChange={(e) => setTokenA(e.target.value)}>
          <option value="XDX">XDX</option>
          <option value="RLUSD">RLUSD</option>
        </select>
      </div>

      <div className="balance-row">
        <span>Amount A</span>
        <input
          type="number"
          value={amountA}
          onChange={(e) => setAmountA(e.target.value)}
        />
      </div>

      <div className="balance-row">
        <span>Token B</span>
        <select value={tokenB} onChange={(e) => setTokenB(e.target.value)}>
          <option value="XRP">XRP</option>
          <option value="RLUSD">RLUSD</option>
        </select>
      </div>

      <div className="balance-row">
        <span>Amount B</span>
        <input
          type="number"
          value={amountB}
          onChange={(e) => setAmountB(e.target.value)}
        />
      </div>

      <button className="connect-wallet-btn" onClick={submit} disabled={loading}>
        {loading ? "Preparing XUMM..." : "Add Liquidity"}
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
