import { aimPnlAllPayload } from "../../../../server/aimPnl.js";

export default async function handler(req, res) {
  const out = await aimPnlAllPayload(req);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "X-Aim-Wallet");
  res.status(out.status).json(out.body);
}
