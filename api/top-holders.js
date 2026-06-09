// api/top-holders.js

import { Client } from "xrpl";

export default async function handler(req, res) {
  const limit = parseInt(req.query.limit || "100", 10);
  const excludeZero = req.query.excludeZero === "true";

  const client = new Client("wss://s1.ripple.com");

  try {
    await client.connect();

    // Load issuer from environment or fallback
    const issuer = process.env.XDX_ISSUER || "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo";

    // IMPORTANT: XDX trustlines use ASCII, NOT HEX
    const currency = "XDX";

    // Request live ledger trustlines
    const holders = await client.request({
      command: "account_lines",
      account: issuer,
      ledger_index: "current"
    });

    // Debug log to confirm trustlines are being read
    console.log("XDX issuer:", issuer);
    console.log("Trustlines returned:", holders.result.lines.length);
    console.log("Sample trustline:", holders.result.lines[0]);

    let filtered = holders.result.lines
      .filter(l => l.currency === currency)
      .map(l => ({
        account: l.account,
        balance: Number(l.balance)
      }));

    // Optional: remove zero balances
    if (excludeZero) {
      filtered = filtered.filter(h => h.balance !== 0);
    }

    // Sort highest → lowest
    filtered.sort((a, b) => b.balance - a.balance);

    // Apply limit
    const result = filtered.slice(0, limit);

    await client.disconnect();
    return res.status(200).json(result);

  } catch (err) {
    console.error("Top holders API error:", err);
    return res.status(500).json({ error: "Failed to load token holders" });
  }
}
