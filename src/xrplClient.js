import xrpl from "xrpl";
import { config } from "./config.js";

// ------------------------------------------------------
// XRPL WebSocket Client (live data, AMM, subscriptions)
// ------------------------------------------------------
export const wsClient = new xrpl.Client(config.xrplWs);

// ------------------------------------------------------
// XRPL RPC Client (HTTPS requests)
// ------------------------------------------------------
export async function rpcRequest(body) {
  try {
    const response = await fetch(config.xrplRpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
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

