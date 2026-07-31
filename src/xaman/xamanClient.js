// src/xaman/xamanClient.js

export async function createPayload() {
  try {
    const response = await fetch("https://xaman.app/api/v1/platform/payload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": import.meta.env.VITE_XAMAN_API_KEY,
        "X-API-Secret": import.meta.env.VITE_XAMAN_API_SECRET
      },
      body: JSON.stringify({
        txjson: {
          TransactionType: "SignIn"
        }
      })
    });

    if (!response.ok) {
      throw new Error("Failed to create payload");
    }

    const payload = await response.json();

    // Validate required fields
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
