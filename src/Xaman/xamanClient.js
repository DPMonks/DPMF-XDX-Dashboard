// src/xaman/xamanClient.js

export async function createPayload() {
  const response = await fetch(
    "http://localhost:3000/api/xaman/create-payload",
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
    websocket: data.websocket
  };
}
