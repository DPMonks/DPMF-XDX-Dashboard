import { Client } from "xrpl";

export default async function handler(req, res) {
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

    let holders = [];

    for (const line of result.lines) {
      if (line.currency !== currency) continue;

      const balance = Math.abs(Number(line.balance));

      if (balance > 0) {
        holders.push({
          account: line.account,
          balance
        });
      }
    }

    holders.sort((a, b) => b.balance - a.balance);

    holders = holders.map((h, i) => ({
      rank: i + 1,
      account: h.account,
      balance: h.balance
    }));

    await client.disconnect();
    return res.status(200).json(holders);

  } catch (err) {
    console.error("Top holders API error:", err);
    return res.status(500).json({ error: "Failed to load token holders" });
  }
}
