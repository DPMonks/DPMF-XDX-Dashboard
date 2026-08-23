import { XIO_CURRENCY, XIO_ISSUER } from "./constants.js";
import { vScoreBadge, xioRank } from "./governance.js";
import { pushActivity } from "./market.js";
import { localVScore, localXioBalance } from "./profile.js";

export const V_SCORE_BLUE = 100;
export const V_SCORE_GOLD = 10000;
export const XIO_VALIDATION_TICK = 0.0001;

export function issuerAddress(nft) {
  return nft?.Issuer || nft?.issuer || nft?.IssuerAddr || null;
}

export function linkedProfileAddress(store, nft) {
  if (!nft) return null;
  for (const profile of store.profiles || []) {
    const pins = profile.profileNfts || [];
    if (
      pins.some(
        (pin) =>
          pin.nftId === nft._id ||
          (nft.NFTokenID && pin.NFTokenID === nft.NFTokenID)
      )
    ) {
      return profile.wAddress;
    }
    if (profile.pImage && nft.image && profile.pImage === nft.image) {
      return profile.wAddress;
    }
  }
  return null;
}

export function addressValidation(store, address) {
  const vScore = localVScore(store, address);
  const xioBalance = localXioBalance(store, address);
  const rank = address === XIO_ISSUER ? "Master Validator" : xioRank(xioBalance);
  return {
    address,
    vScore,
    badge: vScoreBadge(vScore),
    rank,
    xioBalance,
    milestones: {
      blue: V_SCORE_BLUE,
      gold: V_SCORE_GOLD,
      next:
        vScore >= V_SCORE_GOLD
          ? null
          : vScore >= V_SCORE_BLUE
          ? V_SCORE_GOLD
          : V_SCORE_BLUE
    }
  };
}

export function nftValidation(store, nft) {
  const issuer = issuerAddress(nft);
  const linked = linkedProfileAddress(store, nft);
  const issuerState = issuer ? addressValidation(store, issuer) : null;
  const linkedState = linked ? addressValidation(store, linked) : null;
  const vScore = Math.max(issuerState?.vScore || 0, linkedState?.vScore || 0);
  return {
    vScore,
    badge: vScoreBadge(vScore),
    issuer,
    issuerScore: issuerState?.vScore || 0,
    issuerBadge: issuerState?.badge || "tick",
    issuerRank: issuerState?.rank || "Unranked",
    linked,
    linkedScore: linkedState?.vScore || 0,
    linkedBadge: linkedState?.badge || "tick",
    note:
      vScore >= V_SCORE_GOLD
        ? "Gold checkmark: issuer wallet or linked profile reached 10,000 V-Score."
        : vScore >= V_SCORE_BLUE
        ? "Blue checkmark: issuer wallet or linked profile reached 100 V-Score."
        : "No verified checkmark yet. 100 V-Score is blue; 10,000 is gold."
  };
}

function bumpVScore(store, address, delta) {
  store.profiles = store.profiles || [];
  let profile = store.profiles.find((row) => row.wAddress === address);
  if (!profile) {
    profile = { wAddress: address, pName: address.slice(0, 8), vPoint: 0 };
    store.profiles.push(profile);
  }
  profile.vPoint = +(Number(profile.vPoint || 0) + delta).toFixed(6);

  store.leaderboards = store.leaderboards || [];
  let board = store.leaderboards.find((row) => row.wAddress === address);
  if (!board) {
    board = { wAddress: address, pName: profile.pName, totalVPoint: 0 };
    store.leaderboards.push(board);
  }
  board.totalVPoint = +(Number(board.totalVPoint || 0) + delta).toFixed(6);
  board.pName = profile.pName || board.pName;
  return localVScore(store, address);
}

function bumpXioPower(store, address, delta) {
  store.xioHolders = store.xioHolders || [];
  let holder = store.xioHolders.find((row) => row.accountNumber === address);
  if (!holder) {
    holder = { accountNumber: address, balance: { value: "0", currency: XIO_CURRENCY } };
    store.xioHolders.push(holder);
  }
  const next = Number(holder.balance?.value || 0) + delta;
  holder.balance = { value: String(+next.toFixed(8)), currency: XIO_CURRENCY };
  return next;
}

export function applyValidation(store, { from, to, currency, amount }) {
  if (!from || !to) return { ok: false, error: "validator and profile wallet required" };
  if (from === to) return { ok: false, error: "A wallet cannot validate itself" };
  const paid = Number(amount);
  if (!Number.isFinite(paid) || paid <= 0) {
    return { ok: false, error: "Validation requires a fractional payment amount" };
  }
  const asset = String(currency || "XRP").toUpperCase();
  const vScoreDelta = paid;
  const xioTick = asset === XIO_CURRENCY ? Math.max(paid, XIO_VALIDATION_TICK) : XIO_VALIDATION_TICK;
  const vScore = bumpVScore(store, to, vScoreDelta);
  const validatorPower = bumpXioPower(store, from, xioTick);
  const row = {
    _id: `val-${Date.now()}`,
    from,
    to,
    currency: asset,
    amount: String(paid),
    xioTick,
    vScoreDelta,
    createdAt: new Date().toISOString()
  };
  store.validations = store.validations || [];
  store.validations.unshift(row);
  pushActivity(store, {
    type: "validation",
    name: "Profile validation",
    from,
    to,
    amount: String(paid),
    currency: asset
  });
  const target = addressValidation(store, to);
  const validator = addressValidation(store, from);
  return {
    ok: true,
    validation: row,
    target,
    validator: { ...validator, xioBalance: validatorPower },
    message: `Profile validated. V-Score ${vScore} · ${target.badge} checkmark. Validator +${xioTick} XIO (${validator.rank}).`
  };
}

export function withNftValidation(store, nft) {
  if (!nft) return nft;
  const extra = nftValidation(store, nft);
  return { ...nft, vscore: extra.vScore, badge: extra.badge, validation: extra };
}
