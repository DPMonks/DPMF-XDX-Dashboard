import { useState } from "react";
import { XummPkce } from "xumm-oauth2-pkce";

export function useSwap() {
  const [loading, setLoading] = useState(false);
  const [payloadUrl, setPayloadUrl] = useState(null);

  async function swap({ account, tokenIn, tokenOut, amountIn }) {
    setLoading(true);
    setPayloadUrl(null);

    try {
      const xumm = new XummPkce(import.meta.env.VITE_XUMM_API_KEY, {
        implicit: true
      });

      const payload = await xumm.payload.create({
        TransactionType: "AMMOffer",
        Account: account,
        Amount: amountIn,
        Asset: tokenIn,
        Asset2: tokenOut
      });

      setPayloadUrl(payload?.next?.always || null);
    } catch (err) {
      console.error("Swap error:", err);
    }

    setLoading(false);
  }

  return { swap, loading, payloadUrl };
}
