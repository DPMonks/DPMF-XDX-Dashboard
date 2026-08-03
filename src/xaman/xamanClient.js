// src/xaman/xamanClient.js

// Create a new Xaman payload directly from Xaman API
export async function createPayload() {
  try {
    console.log("📡 XamanClient: Creating payload directly from Xaman...");

    const response = await fetch(
      "https://xumm.app/api/v1/platform/payload",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": import.meta.env.VITE_XUMM_API_KEY,
          "X-API-Secret": import.meta.env.VITE_XUMM_API_SECRET
        },
        body: JSON.stringify({
          txjson: {
            TransactionType: "SignIn"
          }
        })
      }
    );

    console.log("📡 XamanClient: Xaman response status:", response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Xaman returned non-OK response:", text);
      throw new Error("Failed to create payload");
    }

    const payload = await response.json();

    console.log("📦 FULL PAYLOAD RECEIVED FROM XAMAN:");
    console.log(JSON.stringify(payload, null, 2));

    return payload;

  } catch (err) {
    console.error("❌ XamanClient error:", err);
    throw err;
  }
}

// Fetch the final signed payload result (account address)
export async function getPayloadResult(uuid) {
  try {
    const response = await fetch(
      `https://xumm.app/api/v1/platform/payload/${uuid}`,
      {
        headers: {
          "X-API-Key": import.meta.env.VITE_XUMM_API_KEY,
          "X-API-Secret": import.meta.env.VITE_XUMM_API_SECRET
        }
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch payload result");
    }

    const result = await response.json();
    return result;

  } catch (err) {
    console.error("❌ XamanClient getPayloadResult error:", err);
    return null;
  }
}
