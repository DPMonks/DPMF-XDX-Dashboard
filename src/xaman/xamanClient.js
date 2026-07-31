// src/xaman/xamanClient.js

export async function createPayload() {
  try {
    const response = await fetch(
      "https://dpmf-xdx-indexer-production.up.railway.app/api/xaman/create-payload",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}) // backend builds the payload itself
      }
    );

    if (!response.ok) {
      throw new Error("Failed to create payload");
    }

    const payload = await response.json();

    // ------------------------------------------------------
    // ROBUST PAYLOAD VALIDATION
    // Xaman returns:
    // - refs.qr_png
    // - refs.deeplink_web
    // - refs.websocket_status_url   (NOT websocket_status)
    // ------------------------------------------------------
    const refs = payload?.refs;

    if (
      !refs?.qr_png ||
      !refs?.deeplink_web ||
      !refs?.websocket_status_url
    ) {
      console.error("Invalid payload structure:", payload);
      throw new Error("Invalid payload structure");
    }

    return payload;

  } catch (err) {
    console.error("XamanClient error:", err);
    throw err;
  }
}
