// api/top-holders.js

import { Client } from "xrpl";

export default async function handler(req, res) {
  const limit = parseInt(req.query.limit || "100", 10);

  const client = new Client("wss://s1.ripple.com");

  try {
    await client.connect();

    const issuer = process.env.XDX_ISSUER || "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo";
    const currency = "XDX";

    const { result } = await client.request({
      command: "account_lines",
      account: issuer,
      ledger_index: "current"
    });

    // Build list of CURRENT XDX holders only
    let holders = [];
    for (const line of result.lines) {
      const balance = Number(line.balance);

      if (
        line.currency === currency &&
        balance > 0 &&
        Number(line.limit) > 0 &&
        !line.freeze
      ) {
        holders.push({
          account: line.account,
          balance
        });
      }
    }

    // Sort highest → lowest
    holders.sort((a, b) => b.balance - a.balance);

    // Add rank numbers
    holders = holders.map((h, i) => ({
      rank: i + 1,
      account: h.account,
      balance: h.balance
    }));

    // Apply limit
    holders = holders.slice(0, limit);

    await client.disconnect();
    return res.status(200).json(holders);

  } catch (err) {
    console.error("Top holders API error:", err);
    return res.status(500).json({ error: "Failed to load token holders" });
  }
}
