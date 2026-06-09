import xrpl from "xrpl";

// ------------------------------------------------------
// XRPL WebSocket Client
// ------------------------------------------------------
export const wsClient = new xrpl.Client("wss://s1.ripple.com");

// ------------------------------------------------------
// RPC ENDPOINTS (Cloudflare Worker Proxy)
// ------------------------------------------------------
const RPC_ENDPOINTS = [
  "https://xdx-proxy.crypto-92e.workers.dev"
];

let activeRpcIndex = 0;

// ------------------------------------------------------
// SMART RPC CLIENT WITH FAILOVER
// ------------------------------------------------------
export async function rpcRequest(body) {
  const total = RPC_ENDPOINTS.length;

  for (let i = 0; i < total; i++) {
    const index = (activeRpcIndex + i) % total;
    const url = RPC_ENDPOINTS[index];

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: body.method,
          params: body.params
        })
      });

      const json = await response.json();

      // RPC returned error
      if (!json || json.error || json.result?.error) {
        console.warn(`[RPC FAILOVER] ${url} returned error, trying next…`);
        continue;
      }

      // AMM missing
      if (body.method === "amm_info" && !json.result?.amm) {
        console.warn(`[RPC FAILOVER] ${url} returned no AMM data, trying next…`);
        continue;
      }

      activeRpcIndex = index;
      return json;

    } catch (err) {
      console.warn(`[RPC FAILOVER] ${url} failed: ${err.message}`);
      continue;
    }
  }

  console.error("[RPC ERROR] All RPC endpoints failed");
  return null;
}

// ------------------------------------------------------
// SAFE fetchAccountLines (CRITICAL FIX FOR TOP HOLDERS)
// ------------------------------------------------------
export async function fetchAccountLines(account) {
  const json = await rpcRequest({
    method: "account_lines",
    params: [{ account, ledger_index: "validated" }]
  });

  // SAFETY: RPC failed or returned no result
  if (!json || !json.result) {
    return [];
  }

  // SAFETY: No trustlines
  if (!Array.isArray(json.result.lines)) {
    return [];
  }

  return json.result.lines;
}

// ------------------------------------------------------
// CONNECT WEBSOCKET CLIENT
// ------------------------------------------------------
export async function connectClients() {
  try {
    console.log("[XRPL] Connecting WebSocket…");
    await wsClient.connect();
    console.log("[XRPL] WebSocket connected");
  } catch (err) {
    console.error("[XRPL WS ERROR]", err);
  }
}

connectClients();
