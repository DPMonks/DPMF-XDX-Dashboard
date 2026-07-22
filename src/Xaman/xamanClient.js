// src/xaman/xamanClient.js

export async function createPayload() {
  const response = await fetch(
    "https://dpmf-xdx-indexer-production.up.railway.app/xaman/create-payload",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error("Failed to create Xaman payload");
  }

  const data = await response.json();

  return {
    refs: {
      qr_png: data.refs.qr_png,
      deeplink_web: data.refs.deeplink_web
    },
    uuid: data.uuid,
    websocket: data.websocket   // REQUIRED for WebSocket sign‑in
  };
}
