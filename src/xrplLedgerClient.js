import fetch from "node-fetch";

// Public XRPL Mainnet RPC endpoint
const XRPL_RPC = "https://s1.ripple.com:51234";

/**
 * Generic RPC wrapper
 */
async function rpc(body) {
  const res = await fetch(XRPL_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const json = await res.json();

  if (json?.result?.error) {
    throw new Error(
      `XRPL RPC Error: ${JSON.stringify(json.result.error)}`
    );
  }

  return json.result;
}

/**
 * Fetch a page of ledger accounts using ledger_data
 * Returns:
 *  - accounts[] (list of account addresses)
 *  - marker (string or null)
 *  - ledgerIndex (number)
 */
export async function fetchLedgerAccounts(marker = null) {
  const body = {
    method: "ledger_data",
    params: [
      {
        ledger_index: "validated",
        type: "account",
        binary: false,
        limit: 1000, // Increase batch size for faster scanning
        ...(marker ? { marker } : {})
      }
    ]
  };

  const result = await rpc(body);

  return {
    accounts: (result.state || []).map(s => s.Account),
    marker: result.marker || null,
    ledgerIndex: result.ledger_index
  };
}

/**
 * Fetch trustlines for a specific account
 */
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
  return result.lines || [];
}
