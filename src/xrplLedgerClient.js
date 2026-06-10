import fetch from "node-fetch";

const XRPL_RPC = "https://s1.ripple.com:51234";

async function rpc(body) {
  const res = await fetch(XRPL_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const json = await res.json();

  // If XRPL returns an error, return a safe empty result instead of throwing
  if (json?.result?.error) {
    return { lines: [], state: [], marker: null };
  }

  return json.result;
}

export async function fetchLedgerAccounts(marker = null) {
  const body = {
    method: "ledger_data",
    params: [
      {
        ledger_index: "validated",
        type: "account",
        binary: false,
        limit: 1000,
        ...(marker ? { marker } : {})
      }
    ]
  };

  const result = await rpc(body);

  return {
    accounts: (result?.state || []).map(s => s.Account),
    marker: result?.marker || null,
    ledgerIndex: result?.ledger_index || null
  };
}

export async function fetchAccountLines(account) {
  const body = {
    method: "account_lines",
    params: [
      {
        account,
        ledger_index: "validated"
      }
    ]
  };

  const result = await rpc(body);

  // Hardened: ALWAYS return an array
  if (!result?.lines || !Array.isArray(result.lines)) {
    return [];
  }

  return result.lines;
}

console.log("[XRPL] SAFE xrplLedgerClient loaded");

