// api/top-holders.js

import { Client } from "xrpl";

export default async function handler(req, res) {
  const limit = parseInt(req.query.limit || "100", 10);

  const client = new Client("wss://s1.ripple.com");

  try {
    await client.connect();

    const issuer = process.env.XDX_ISSUER || "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo";
    const currency = "XDX";

    // Fetch trustlines from live ledger
    const { result } = await client.request({
      command: "account_lines",
      account: issuer,
      ledger_index: "current"
    });

    // Build list of CURRENT XDX holders only
    const holders = [];
    for (const line of result.lines) {
      if (
        line.currency === currency &&        // must be XDX
        Number(line.balance) > 0 &&          // must hold XDX right now
        Number(line.limit) > 0 &&            // must have an active trustline
        !line.freeze                         // trustline must not be frozen
      ) {
        holders.push({
          account: line.account,
          balance: Number(line.balance)
        });
      }
    }

    // Sort highest → lowest
    holders.sort((a, b) => b.balance - a.balance);

    // Apply limit
    const resultList = holders.slice(0, limit);

    await client.disconnect();
    return res.status(200).json(resultList);

  } catch (err) {
    console.error("Top holders API error:", err);
    return res.status(500).json({ error: "Failed to load token holders" });
  }
}
