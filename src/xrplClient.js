import xrpl from "xrpl";
import { config } from "./config.js";

// ------------------------------------------------------
// XRPL WebSocket Client (for AMM + live data)
// ------------------------------------------------------
export const client = new xrpl.Client(config.xrplWs);

// ------------------------------------------------------
// XRPL JSON-RPC Client (for account_lines, holders, etc.)
// ------------------------------------------------------
export const rpc = new xrpl.Client(config.xrplWs);

// ------------------------------------------------------
// Connect both clients BEFORE any requests are made
// ------------------------------------------------------
export async function connectClients() {
  try {
    await client.connect();
    await rpc.connect();
    console.log("XRPL clients connected");
  } catch (err) {
    console.error("XRPL connection error:", err);
  }
}

// Immediately connect on startup
connectClients();
