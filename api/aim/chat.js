import { aimChatPayload } from "../../server/aimMatrix.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "POST only" });
    return;
  }
  // Vercel provides parsed body; adapt to aimChatPayload's req reader via fake stream
  const fakeReq = {
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(JSON.stringify(req.body || {}));
    },
  };
  const out = await aimChatPayload(fakeReq);
  res.status(out.status).json(out.body);
}
