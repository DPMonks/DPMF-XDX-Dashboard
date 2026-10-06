import { writeIndexerResponse } from "../server/vercelHandler.js";

export const maxDuration = 60;

export default async function handler(req, res) {
  await writeIndexerResponse(req, res);
}
