import { extractSignedAccount, getPayloadResult } from "./xamanClient.js";
import { isPayloadUuid } from "./payloadResume.js";

export async function claimSignedWallet(
  uuid,
  { fetchResult = getPayloadResult, tries = 8, waitMs = 400 } = {}
) {
  const id = String(uuid || "").trim();
  if (!isPayloadUuid(id)) return null;

  for (let attempt = 0; attempt < tries; attempt += 1) {
    const result = await fetchResult(id).catch(() => null);
    const account = extractSignedAccount(result);
    if (account) return account;
    if (result?.meta?.cancelled === true || result?.meta?.expired === true) return null;
    if (attempt < tries - 1) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  return null;
}
