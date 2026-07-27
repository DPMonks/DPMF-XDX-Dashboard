// src/xaman/xamanClient.js

export async function createPayload() {
  const response = await fetch(
    "https://dpmf-xdx-indexer-production.up.railway.app/api/xaman/create-payload",
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

  // ✅ Correct mapping for Xumm/Xaman payload structure
  return {
    refs: {
      qr_png: data.refs.qr_png,
      deeplink_web: data.refs.deeplink_web,
      websocket_status: data.refs.websocket_status
    },
    uuid: data.uuid
  };
}
