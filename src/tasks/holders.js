import { rpcRequest } from "../xrplClient.js";

export async function fetchHolders(account) {
  try {
    const body = {
      method: "account_lines",
      params: [
        {
          account: account,
          ledger_index: "validated"
        }
      ]
    };

    const res = await rpcRequest(body);

    if (!res || !res.result || !res.result.lines) {
      console.warn("[HOLDERS] RPC returned no result");
      return [];
    }

    return res.result.lines;

  } catch (err) {
    console.error("[HOLDERS ERROR]", err);
    return [];
  }
}
