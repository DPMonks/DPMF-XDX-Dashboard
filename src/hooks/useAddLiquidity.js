import { useState } from "react";
import { XummPkce } from "xumm-oauth2-pkce";

export function useAddLiquidity() {
  const [loading, setLoading] = useState(false);
  const [payloadUrl, setPayloadUrl] = useState(null);

  async function addLiquidity({ account, tokenA, tokenB, amountA, amountB }) {
    setLoading(true);
    setPayloadUrl(null);

    try {
      const xumm = new XummPkce(import.meta.env.VITE_XUMM_API_KEY, {
        implicit: true
      });

      const payload = await xumm.payload.create({
        TransactionType: "AMMDeposit",
        Account: account,
        Amount: amountA,
        Amount2: amountB,
        Asset: tokenA,
        Asset2: tokenB
      });

      setPayloadUrl(payload?.next?.always || null);
    } catch (err) {
      console.error("AMMDeposit error:", err);
    }

    setLoading(false);
  }

  return { addLiquidity, loading, payloadUrl };
}
