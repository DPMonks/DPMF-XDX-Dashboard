// api/public/top-lp.js

import { Client } from "xrpl";

export default async function handler(req, res) {
  const limit = parseInt(req.query.limit || "100", 10);

  const client = new Client("wss://s1.ripple.com");

  try {
    await client.connect();

    const lpIssuer = process.env.LP_ISSUER;
    const lpCurrency = process.env.LP_CURRENCY_HEX; // 40-char hex code

    if (!lpIssuer || !lpCurrency) {
      return res.status(500).json({
        error: "Missing LP_ISSUER or LP_CURRENCY_HEX environment variables"
      });
    }

    const lines = await client.request({
      command: "account_lines",
      account: lpIssuer,
      ledger_index: "validated"
    });

    const filtered = lines.result.lines
      .filter(l => l.currency === lpCurrency)
      .map(l => ({
        account: l.account,
        balance: Number(l.balance)
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, limit);

    await client.disconnect();
    return res.status(200).json(filtered);

  } catch (err) {
    console.error("Top LP API error:", err);
    return res.status(500).json({ error: "Failed to load LP holders" });
  }
}
