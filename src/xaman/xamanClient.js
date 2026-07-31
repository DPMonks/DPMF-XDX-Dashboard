// src/xaman/xamanClient.js

export async function createPayload() {
  try {
    console.log("📡 XamanClient: Sending payload request to backend...");

    const response = await fetch(
      "https://dpmf-xdx-indexer-production.up.railway.app/api/xaman/create-payload",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}) // backend builds the payload itself
      }
    );

    console.log("📡 XamanClient: Backend response status:", response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Backend returned non-OK response:", text);
      throw new Error("Failed to create payload");
    }

    const payload = await response.json();

    console.log("📦 FULL PAYLOAD RECEIVED FROM BACKEND:");
    console.log(JSON.stringify(payload, null, 2));

    // ------------------------------------------------------
    // ROBUST PAYLOAD VALIDATION
    // Xaman returns:
    // - refs.qr_png
    // - refs.deeplink_web
    // - refs.websocket_status_url
    // ------------------------------------------------------
    const refs = payload?.refs;

    if (
      !refs?.qr_png ||
      !refs?.deeplink_web ||
      !refs?.websocket_status_url
    ) {
      console.error("❌ Invalid payload structure FULL PAYLOAD:", JSON.stringify(payload, null, 2));
      throw new Error("Invalid payload structure");
    }

    console.log("✅ Payload validated successfully.");
    return payload;

  } catch (err) {
    console.error("❌ XamanClient error:", err);
    throw err;
  }
}
