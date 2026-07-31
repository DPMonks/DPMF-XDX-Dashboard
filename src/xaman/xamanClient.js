// src/xaman/xamanClient.js

// This calls YOUR backend route, not Xaman directly.
// Your backend will safely handle API Key + Secret.

export async function createPayload() {
  try {
    const response = await fetch("/api/xaman/create-payload", {
      method: "POST"
    });

    if (!response.ok) {
      throw new Error("Failed to create payload");
    }

    const payload = await response.json();

    // Validate required fields from Xaman
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
