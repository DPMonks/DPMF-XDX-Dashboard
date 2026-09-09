import { aimLocalePayload } from "../../server/aimMatrix.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "GET only" });
    return;
  }
  const out = aimLocalePayload(req);
  res.status(out.status).json(out.body);
}
