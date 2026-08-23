import { detectTradeExecution } from "./detectExecution.js";
import { extractSignedAccount, getPayloadResult } from "./xamanClient.js";
import { isPayloadUuid, peekPendingPayload } from "./payloadResume.js";
import { notifyTradeExecuted, notifyTradeFailed } from "./tradeTx.js";

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

export async function claimExecutedTrade(
  uuid,
  { fetchResult = getPayloadResult, tries = 10, waitMs = 500 } = {}
) {
  const id = String(uuid || "").trim();
  if (!isPayloadUuid(id)) return null;
  const pending = peekPendingPayload();
  const txjson = pending?.txjson || null;

  for (let attempt = 0; attempt < tries; attempt += 1) {
    const result = await fetchResult(id).catch(() => null);
    if (result?.meta?.cancelled === true || result?.meta?.expired === true) return null;
    const detection = detectTradeExecution({ payload: result });
    if (detection.failed) {
      const account = extractSignedAccount(result) || detection.account || null;
      notifyTradeFailed({ ...detection, uuid: id, account, txjson });
      return { ...detection, executed: false, account, result };
    }
    if (detection.rejected) return null;
    if (detection.executed) {
      const account = extractSignedAccount(result) || detection.account || null;
      notifyTradeExecuted({
        ...detection,
        executed: true,
        uuid: id,
        account,
        txjson,
      });
      return { ...detection, executed: true, account, result };
    }
    if (attempt < tries - 1) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  return null;
}
