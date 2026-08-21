import { readJson, xummHeaders } from "./_xumm.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = await readJson(req);
    const response = await fetch("https://xumm.app/api/v1/platform/payload", {
      method: "POST",
      headers: xummHeaders(),
      body: JSON.stringify({
        txjson: body.txjson || { TransactionType: "SignIn" },
      }),
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to create Xaman payload" });
  }
}
