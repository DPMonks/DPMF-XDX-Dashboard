import { useState } from "react";
import { XummSdkJwt } from "xumm-sdk";

export function useRemoveLiquidity() {
  const [loading, setLoading] = useState(false);
  const [payloadUrl, setPayloadUrl] = useState(null);

  async function removeLiquidity({ account, lpToken, amount }) {
    setLoading(true);
    setPayloadUrl(null);

    try {
      const sdk = new XummSdkJwt(import.meta.env.VITE_XUMM_API_KEY);

      const payload = {
        txjson: {
          TransactionType: "AMMWithdraw",
          Account: account,
          LPToken: {
            currency: lpToken.currency,
            issuer: lpToken.issuer
          },
          Amount: amount
        }
      };

      const res = await sdk.payload.create(payload);
      setPayloadUrl(res.next.always);
    } catch (err) {
      console.error("AMMWithdraw error:", err);
    }

    setLoading(false);
  }

  return { removeLiquidity, loading, payloadUrl };
}
