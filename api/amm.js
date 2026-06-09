// api/public/amm.js

import { Client } from "xrpl";

export default async function handler(req, res) {
  const client = new Client("wss://s1.ripple.com");

  try {
    await client.connect();

    const amm = await client.request({
      command: "amm_info",
      amm_account: process.env.AMM_ACCOUNT   // set in Railway
    });

    await client.disconnect();
    return res.status(200).json(amm.result);

  } catch (err) {
    console.error("AMM API error:", err);
    return res.status(500).json({ error: "Failed to load AMM data" });
  }
}
