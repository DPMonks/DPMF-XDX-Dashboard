import { aimSpeakPayload } from "../../server/aimSpeak.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "POST only" });
    return;
  }
  const out = await aimSpeakPayload(req);
  if (out.audio) {
    res.setHeader("Content-Type", out.contentType || "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    if (out.meta?.id) res.setHeader("X-Aim-Voice", out.meta.id);
    res.status(out.status).send(out.audio);
    return;
  }
  res.status(out.status).json(out.body);
}
