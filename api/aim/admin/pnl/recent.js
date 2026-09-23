import { aimPnlRecentPayload } from "../../../../server/aimPnl.js";

export default async function handler(req, res) {
  const out = await aimPnlRecentPayload(req);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "X-Aim-Wallet");
  res.status(out.status).json(out.body);
}
