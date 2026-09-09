import { aimChatPayload } from "../../server/aimMatrix.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "POST only" });
    return;
  }
  const out = await aimChatPayload(req);
  res.status(out.status).json(out.body);
}
