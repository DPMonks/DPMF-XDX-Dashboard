// src/xaman/xamanClient.js

export async function createPayload() {
  try {
    const response = await fetch(
      "https://dpmf-xdx-indexer-production.up.railway.app/api/xaman/create-payload",
      { method: "POST" }
    );

    if (!response.ok) {
      throw new Error("Failed to create payload");
    }

    const payload = await response.json();

    if (
      !payload.refs ||
      !payload.refs.qr_png ||
      !payload.refs.deeplink_web ||
      !payload.refs.websocket_status
    ) {
      throw new Error("Invalid payload structure");
    }

    return payload;
  } catch (err) {
    console.error("XamanClient error:", err);
    throw err;
  }
}
