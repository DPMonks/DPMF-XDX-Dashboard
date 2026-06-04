import xrpl from "xrpl";

// ------------------------------------------------------
// XRPL WebSocket Client (for connectivity only)
// ------------------------------------------------------
export const wsClient = new xrpl.Client("wss://s1.ripple.com");

// ------------------------------------------------------
// CLOUDFLARE WORKER RPC ENDPOINT (RAILWAY‑SAFE)
// ------------------------------------------------------
const RPC_ENDPOINTS = [
  "https://xdx-proxy.crypto-92e.workers.dev"
];

// Keep track of which endpoint is currently working
let activeRpcIndex = 0;

// ------------------------------------------------------
// SMART RPC CLIENT WITH STICKY FAILOVER
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

      if (!json || json.error || json.result?.error) {
        console.warn(`[RPC FAILOVER] ${url} returned error, trying next…`);
        continue;
      }

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
// Connect WebSocket client on startup
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
