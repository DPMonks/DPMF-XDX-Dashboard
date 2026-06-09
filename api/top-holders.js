// api/public/top-holders.js

import { Client } from "xrpl";

export default async function handler(req, res) {
  const limit = parseInt(req.query.limit || "100", 10);

  const client = new Client("wss://s1.ripple.com");

  try {
    await client.connect();

    const issuer = process.env.XDX_ISSUER;
    const currency = process.env.XDX_CURRENCY_HEX; // 40-char hex

    const holders = await client.request({
      command: "account_lines",
      account: issuer,
      ledger_index: "validated"
    });

    // Filter only XDX trustlines
    const filtered = holders.result.lines
      .filter(l => l.currency === currency)
      .map(l => ({
        account: l.account,
        balance: Number(l.balance)
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, limit);

    await client.disconnect();
    return res.status(200).json(filtered);

  } catch (err) {
    console.error("Top holders API error:", err);
    return res.status(500).json({ error: "Failed to load token holders" });
  }
}
