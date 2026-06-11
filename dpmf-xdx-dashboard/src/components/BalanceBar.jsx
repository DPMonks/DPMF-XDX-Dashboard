import { useWallet } from "../context/WalletContext";
import { useEffect, useState } from "react";
import Sparkline from "./Sparkline";

export default function BalanceBar() {
  const { walletAddress } = useWallet();

  const [data, setData] = useState({
    xrp: 0,
    xdx: 0,
    lp: 0,
    prices: { xrpUsd: 0, xrpGbp: 0, xdxUsd: 0, xdxGbp: 0 },
    change: { xrp: 0, xdx: 0, lp: 0 },
    networth: { totalUsd: 0, totalGbp: 0 },
    spark: { xrp: [], xdx: [], lp: [] }
  });

  useEffect(() => {
    if (!walletAddress) return;

    const load = async () => {
      const bal = await fetch(`/api/wallet/balances/${walletAddress}`).then(r => r.json());
      const prices = await fetch(`/api/prices`).then(r => r.json());
      const change = await fetch(`/api/prices/change24h`).then(r => r.json());
      const networth = await fetch(`/api/wallet/networth/${walletAddress}`).then(r => r.json());

      const sparkXrp = await fetch(`/api/sparkline/XRP`).then(r => r.json());
      const sparkXdx = await fetch(`/api/sparkline/XDX`).then(r => r.json());
      const sparkLp = await fetch(`/api/sparkline/LP`).then(r => r.json());

      setData({
        xrp: bal.xrp,
        xdx: bal.xdx,
        lp: bal.lp,
        prices,
        change,
        networth,
        spark: {
          xrp: sparkXrp.map(p => p.price_usd),
          xdx: sparkXdx.map(p => p.price_usd),
          lp: sparkLp.map(p => p.price_usd)
        }
      });
    };

    load();
  }, [walletAddress]);

  if (!walletAddress) return null;

  const items = [
    {
      label: "XRP",
      amount: data.xrp,
      usd: data.xrp * data.prices.xrpUsd,
      gbp: data.xrp * data.prices.xrpGbp,
      change: data.change.xrp,
      spark: data.spark.xrp
    },
    {
      label: "XDX",
      amount: data.xdx,
      usd: data.xdx * data.prices.xdxUsd,
      gbp: data.xdx * data.prices.xdxGbp,
      change: data.change.xdx,
      spark: data.spark.xdx
    },
    {
      label: "LP Tokens",
      amount: data.lp,
      usd: data.lp * data.prices.xdxUsd * 2,
      gbp: data.lp * data.prices.xdxGbp * 2,
      change: data.change.lp,
      spark: data.spark.lp
    }
  ];

  return (
    <>
      {/* NET WORTH PANEL */}
      <div className="networth-box">
        <h3>Wallet Net Worth</h3>
        <p>£{data.networth.totalGbp.toFixed(2)} / ${data.networth.totalUsd.toFixed(2)}</p>
      </div>

      {/* BALANCE BAR */}
      <div className="balance-bar">
        {items.map((i, idx) => (
          <div key={idx} className="balance-item">
            <h3>{i.label}</h3>

            <p className="balance-amount">{i.amount.toLocaleString()}</p>

            <p className="balance-fiat">
              £{i.gbp.toFixed(2)} / ${i.usd.toFixed(2)}
            </p>

            <Sparkline data={i.spark} />

            <p className={i.change >= 0 ? "change-up" : "change-down"}>
              {i.change >= 0 ? "▲" : "▼"} {i.change.toFixed(2)}%
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
