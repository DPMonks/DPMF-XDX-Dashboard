export const config = {
  api: {
    bodyParser: {
      sizeLimit: "32kb",
    },
    responseLimit: false,
  },
  maxDuration: 30,
};

import { aimSpeakPayload } from "../../server/aimSpeak.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "POST only" });
    return;
  }
  try {
    const out = await aimSpeakPayload(req);
    if (out.audio) {
      res.setHeader("Content-Type", out.contentType || "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      if (out.meta?.id) res.setHeader("X-Aim-Voice", out.meta.id);
      res.status(out.status).send(Buffer.from(out.audio));
      return;
    }
    res.status(out.status).json(out.body);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "Speak handler crashed",
      detail: String(error?.message || error).slice(0, 240),
    });
  }
}
