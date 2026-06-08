// api/public/overview.js

import { Client } from "xrpl";

export default async function handler(req, res) {
  const client = new Client("wss://s1.ripple.com");

  try {
    await client.connect();

    const ledger = await client.request({ command: "ledger_current" });

    const response = {
      ledger_index: ledger.result.ledger_current_index,
      timestamp: Date.now()
    };

    await client.disconnect();
    return res.status(200).json(response);

  } catch (err) {
    console.error("Overview API error:", err);
    return res.status(500).json({ error: "Failed to load XRPL overview" });
  }
}
