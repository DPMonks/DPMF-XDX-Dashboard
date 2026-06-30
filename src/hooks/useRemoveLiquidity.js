import { useState } from "react";
import { XummPkce } from "xumm-oauth2-pkce";

export function useRemoveLiquidity() {
  const [loading, setLoading] = useState(false);
  const [payloadUrl, setPayloadUrl] = useState(null);

  async function removeLiquidity({ account, lpToken, amount }) {
    setLoading(true);
    setPayloadUrl(null);

    try {
      const xumm = new XummPkce(import.meta.env.VITE_XUMM_API_KEY, {
        implicit: true
      });

      const payload = await xumm.payload.create({
        TransactionType: "AMMWithdraw",
        Account: account,
        LPToken: {
          currency: lpToken.currency,
          issuer: lpToken.issuer
        },
        Amount: amount
      });

      setPayloadUrl(payload?.next?.always || null);
    } catch (err) {
      console.error("AMMWithdraw error:", err);
    }

    setLoading(false);
  }

  return { removeLiquidity, loading, payloadUrl };
}
