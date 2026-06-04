import xrpl from "xrpl";

// ------------------------------------------------------
// XRPL WebSocket Client (for connectivity only)
// ------------------------------------------------------
export const wsClient = new xrpl.Client("wss://s1.ripple.com");

// ------------------------------------------------------
// RPC ENDPOINT FAILOVER LIST
// ------------------------------------------------------
const RPC_ENDPOINTS = [
  "https://s2.ripple.com:51234",       // Full rippled (best)
  "https://xrplcluster.com",           // Full rippled cluster
  "https://rippled.xrpldata.com"       // Backup full rippled
];

// ------------------------------------------------------
// XRPL RPC Client with automatic failover
// ------------------------------------------------------
export async function rpcRequest(body) {
  for (const url of RPC_ENDPOINTS) {
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

      // Skip if server returned an error
      if (!json || json.error || json.result?.error) {
        console.warn(`[RPC FAILOVER] ${url} returned error, trying next…`);
        continue;
      }

      // Skip Clio servers (they cannot serve AMM or full trust lines)
      if (json.warnings && json.warnings.some(w => w.message?.includes("clio"))) {
        console.warn(`[RPC FAILOVER] ${url} is a Clio server, skipping…`);
        continue;
      }

      // Skip empty AMM responses
      if (body.method === "amm_info" && !json.result?.amm) {
        console.warn(`[RPC FAILOVER] ${url} returned no AMM data, trying next…`);
        continue;
      }

      // Valid response
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

