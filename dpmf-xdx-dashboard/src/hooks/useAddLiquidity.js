import { useState } from "react";
import { XummSdkJwt } from "xumm-sdk";

export function useAddLiquidity() {
  const [loading, setLoading] = useState(false);
  const [payloadUrl, setPayloadUrl] = useState(null);

  async function addLiquidity({ account, tokenA, tokenB, amountA, amountB }) {
    setLoading(true);
    setPayloadUrl(null);

    try {
      const sdk = new XummSdkJwt(import.meta.env.VITE_XUMM_API_KEY);

      const payload = {
        txjson: {
          TransactionType: "AMMDeposit",
          Account: account,
          Amount: amountA,
          Amount2: amountB,
          Asset: tokenA,
          Asset2: tokenB
        }
      };

      const res = await sdk.payload.create(payload);
      setPayloadUrl(res.next.always);
    } catch (err) {
      console.error("AMMDeposit error:", err);
    }

    setLoading(false);
  }

  return { addLiquidity, loading, payloadUrl };
}
