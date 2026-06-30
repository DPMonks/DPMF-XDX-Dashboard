// src/utils/Xaman.js
// Frontend-safe wrapper that calls your Vercel serverless function

export async function generateQrPayload() {
  try {
    const response = await fetch("/api/create-xumm-payload");

    if (!response.ok) {
      throw new Error(`Failed to create payload: HTTP ${response.status}`);
    }

    const payload = await response.json();

    return {
      qr: payload.qr || null,
      uuid: payload.uuid || null,
      websocket: payload.websocket || null
    };
  } catch (err) {
    console.error("Xaman QR generation error:", err);
    throw err;
  }
}
