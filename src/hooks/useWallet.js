import { useState } from "react";
import { Client } from "xrpl";

export function useBalances() {
  const [balances, setBalances] = useState([]);
  const [lpBalances, setLpBalances] = useState([]);

  async function fetchBalances(account) {
    try {
      const client = new Client("wss://s1.ripple.com");
      await client.connect();

      const res = await client.request({
        command: "account_lines",
        account,
        ledger_index: "validated"
      });

      const lines = res.result.lines || [];

      // Normal tokens (exclude LP tokens)
      const tokens = lines
        .filter(l => !l.currency.includes("LP"))
        .map(l => ({
          currency: l.currency,
          issuer: l.account,
          balance: Number(l.balance)
        }));

      // LP tokens (currency contains LP)
      const lp = lines
        .filter(l => l.currency.includes("LP"))
        .map(l => ({
          currency: l.currency,
          issuer: l.account,
          balance: Number(l.balance)
        }));

      setBalances(tokens);
      setLpBalances(lp);

      client.disconnect();
    } catch (err) {
      console.error("Balance fetch error:", err);
    }
  }

  return { balances, lpBalances, fetchBalances };
}
