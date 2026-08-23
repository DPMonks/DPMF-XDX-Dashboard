import { XIO_CURRENCY, XIO_ISSUER } from "./constants.js";
import { xioRank, vScoreBadge } from "./governance.js";
import { accountLines } from "./xrpl.js";
import { walletTokenData } from "./indexer.js";

function looksLikeXrpl(address) {
  return typeof address === "string" && /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
}

export function localXioBalance(store, address) {
  const holder = (store.xioHolders || []).find((row) => row.accountNumber === address);
  if (holder?.balance?.value != null) return Number(holder.balance.value) || 0;
  return 0;
}

export function localVScore(store, address) {
  const board = (store.leaderboards || []).find((row) => row.wAddress === address);
  const profile = (store.profiles || []).find((row) => row.wAddress === address);
  return Number(board?.totalVPoint ?? profile?.vPoint ?? 0) || 0;
}

export function xioFromLines(lines) {
  if (!lines?.ok) return null;
  const row = (lines.result?.lines || []).find(
    (line) =>
      line.account === XIO_ISSUER ||
      line.currency === XIO_CURRENCY ||
      String(line.currency || "").includes("XIO")
  );
  return row ? Number(row.balance) || 0 : 0;
}

export async function enrichAddress(store, address) {
  const profile =
    (store.profiles || []).find((row) => row.wAddress === address) || {
      wAddress: address
    };
  let xioBalance = localXioBalance(store, address);
  let lines = null;
  let tokens = null;

  if (looksLikeXrpl(address)) {
    const [trust, wallet] = await Promise.all([
      accountLines(address).catch(() => ({ ok: false })),
      walletTokenData(address).catch(() => ({ ok: false }))
    ]);
    lines = trust;
    const live = xioFromLines(trust);
    if (live != null && trust.ok) xioBalance = live;
    tokens = wallet.ok ? wallet.data : null;
  }

  const vScore = localVScore(store, address);
  const rank = xioRank(xioBalance);
  return {
    ...profile,
    xioBalance,
    rdxBalance: xioBalance,
    level: rank,
    rank,
    vScore,
    badge: vScoreBadge(vScore),
    tokens,
    xrplLines: lines?.ok ? lines.result?.lines?.length || 0 : 0
  };
}

export function xioDashboardRows(store) {
  return (store.xioHolders || []).map((row) => ({
    accountNumber: row.accountNumber,
    balance: {
      value: String(row.balance?.value ?? 0),
      currency: row.balance?.currency || XIO_CURRENCY
    }
  }));
}

export function vScoreDashboardRows(store) {
  return (store.leaderboards || []).map((row) => {
    const profile = (store.profiles || []).find((item) => item.wAddress === row.wAddress);
    return {
      address: row.wAddress,
      pName: row.pName || profile?.pName || "N/A",
      pImage: profile?.pImage || "",
      vScoreSum: Number(row.totalVPoint) || 0,
      badge: vScoreBadge(row.totalVPoint)
    };
  });
}
