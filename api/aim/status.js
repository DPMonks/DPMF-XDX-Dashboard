import { aimStatusPayload } from "../../server/aimMatrix.js";

export default async function handler(_req, res) {
  const out = await aimStatusPayload();
  res.status(out.status).json(out.body);
}
