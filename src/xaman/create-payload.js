// src/xaman/create-payload.js

import fetch from "node-fetch";

export async function createPayloadBackend(req, res) {
  try {
    // Call the official Xaman Platform API from the backend (safe)
    const response = await fetch("https://xaman.app/api/v1/platform/payload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.XAMAN_API_KEY,
        "X-API-Secret": process.env.XAMAN_API_SECRET
      },
      body: JSON.stringify({
        txjson: {
          TransactionType: "SignIn"
        }
      })
    });

    if (!response.ok) {
      console.error("Xaman API error:", await response.text());
      return res.status(500).json({ error: "Failed to create payload" });
    }

    const payload = await response.json();
    return res.status(200).json(payload);

  } catch (err) {
    console.error("Backend Xaman error:", err);
    return res.status(500).json({ error: "Backend error creating payload" });
  }
}
