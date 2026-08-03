// src/xaman/xamanClient.js
// Dashboard-side client that calls the INDEXER (not XUMM)

export async function createPayload() {
  try {
    console.log("📡 XamanClient: Requesting payload from INDEXER...");

    const response = await fetch(
      "https://dpmf-xdx-indexer-production.up.railway.app/api/xaman/create-payload",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      }
    );

    console.log("📡 XamanClient: Indexer response status:", response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Indexer returned non-OK response:", text);
      throw new Error("Failed to create payload");
    }

    const payload = await response.json();

    console.log("📦 FULL PAYLOAD RECEIVED FROM INDEXER:");
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
      `https://dpmf-xdx-indexer-production.up.railway.app/api/xaman/payload-result?uuid=${uuid}`
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
