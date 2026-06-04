import xrpl from "xrpl";

// ------------------------------------------------------
// XRPL WebSocket Client (for AMM + live data)
// ------------------------------------------------------
export const wsClient = new xrpl.Client("wss://s1.ripple.com");

// ------------------------------------------------------
// XRPL RPC Client (HTTPS requests)
// ------------------------------------------------------
export async function rpcRequest(body) {
  try {
    const response = await fetch("https://s1.ripple.com:51234", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: body.method,
        params: body.params
      })
    });

    return await response.json();
  } catch (err) {
    console.error("[XRPL RPC ERROR]", err);
    return null;
  }
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

