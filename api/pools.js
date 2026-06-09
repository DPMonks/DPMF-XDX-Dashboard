// api/public/pools.js

import { Client } from "xrpl";

export default async function handler(req, res) {
  const client = new Client("wss://s1.ripple.com");

  try {
    await client.connect();

    const pools = await client.request({
      command: "amm_list"
    });

    await client.disconnect();
    return res.status(200).json(pools.result);

  } catch (err) {
    console.error("Pools API error:", err);
    return res.status(500).json({ error: "Failed to load pool stats" });
  }
}
