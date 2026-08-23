import { createHmac } from "node:crypto";
import { resolveNft } from "./collections.js";
import { encodeCurrency } from "./currency.js";
import {
  DEFAULT_ROYALTY_BPS,
  acceptOffer,
  burnNft,
  buyNow,
  cancelOffer,
  delist,
  listForSale,
  placeOffer
} from "./market.js";
import { accountInfo, accountLines } from "./xrpl.js";

export const XUMM_API = "https://xumm.app/api/v1/platform";
export const SIGN_URL = "https://xumm.app/sign";

const SESSION_DAYS = 30;

export function xamanKey() {
  return String(process.env.XUMM_API_KEY || "").trim();
}

export function xamanSecret() {
  return String(process.env.XUMM_API_SECRET || "").trim();
}

export function xamanConfigured() {
  return Boolean(xamanKey() && xamanSecret());
}

export function jwtSecret() {
  return String(process.env.JWT_SECRET || xamanSecret() || "fuzion-xio-dev-jwt").trim();
}

export function notConfigured(feature = "Xaman") {
  return {
    success: false,
    implemented: false,
    configured: false,
    message: `${feature} needs XUMM_API_KEY and XUMM_API_SECRET. Add them from https://apps.xumm.dev — do not commit the secret.`
  };
}

function b64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function signSession(account, extra = {}) {
  const address = String(account || "").trim();
  if (!address) throw new Error("account required");
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlJson({ alg: "HS256", typ: "JWT" });
  const payload = b64urlJson({
    ac: address,
    address,
    iat: now,
    exp: now + SESSION_DAYS * 24 * 60 * 60,
    ...extra
  });
  const data = `${header}.${payload}`;
  const sig = createHmac("sha256", jwtSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function decodeSession(token) {
  const raw = String(token || "")
    .replace(/^Basic\s+/i, "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!raw || raw.split(".").length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(raw.split(".")[1], "base64url").toString());
    const address = payload.ac || payload.address || "";
    if (!address) return null;
    return { ...payload, ac: address, address };
  } catch {
    return null;
  }
}

export function verifySession(token) {
  const raw = String(token || "")
    .replace(/^Basic\s+/i, "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const expected = createHmac("sha256", jwtSecret()).update(data).digest("base64url");
  if (expected !== parts[2]) return decodeSession(raw);
  const session = decodeSession(raw);
  if (session?.exp && session.exp * 1000 < Date.now()) return null;
  return session;
}

export function accountFromAuth(req = {}) {
  const body = req.body || {};
  if (body.account || body.wAddress || body.from || body.Address) {
    return String(body.account || body.wAddress || body.from || body.Address).trim();
  }
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const token = body.token || header;
  return verifySession(token)?.ac || decodeSession(token)?.ac || "";
}

export function xummHeaders() {
  return {
    "content-type": "application/json",
    Accept: "application/json",
    "X-API-Key": xamanKey(),
    "X-API-Secret": xamanSecret()
  };
}

export function toHex(text) {
  return Buffer.from(String(text || ""), "utf8").toString("hex").toUpperCase();
}

export function xrpDrops(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return "0";
  return String(Math.round(n * 1_000_000));
}

export function amountForXrpl({ amount, currency, issuer } = {}) {
  const code = String(currency || "XRP").trim() || "XRP";
  if (code === "XRP" || !issuer) return xrpDrops(amount);
  return {
    currency: encodeCurrency(code),
    issuer,
    value: String(amount ?? "0")
  };
}

export function transferFeeFromBps(bps = DEFAULT_ROYALTY_BPS) {
  const n = Number(bps);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(50000, Math.round(n * 10));
}

export function txjsonFor(kind, body = {}, account = "") {
  const nftId = body.NFTokenID || body.nftokenID || body.nft_id || "";
  const offerIndex = body.nftOfferIndex || body.offerIndex || body.NFTokenSellOffer || "";
  const dest = body.destAdd || body.destination || body.Destination || "";

  switch (kind) {
    case "connect":
    case "register":
    case "signin":
      return { TransactionType: "SignIn" };
    case "mint":
      return {
        TransactionType: "NFTokenMint",
        Account: account,
        URI: toHex(body.uri || body.image || body.URL || ""),
        Flags: 8,
        TransferFee: transferFeeFromBps(body.royaltyBps || body.TransferFee || DEFAULT_ROYALTY_BPS),
        NFTokenTaxon: Number(body.taxon || body.NFTokenTaxon || 0)
      };
    case "sale":
      return {
        TransactionType: "NFTokenCreateOffer",
        Account: account,
        NFTokenID: nftId,
        Amount: amountForXrpl(body),
        Flags: 1
      };
    case "buy":
    case "makeOffer":
      return {
        TransactionType: "NFTokenCreateOffer",
        Account: account,
        NFTokenID: nftId,
        Amount: amountForXrpl(body),
        ...(body.Owner || body.nft_owner ? { Owner: body.Owner || body.nft_owner } : {})
      };
    case "acceptOffer":
      return {
        TransactionType: "NFTokenAcceptOffer",
        Account: account,
        ...(body.NFTokenBuyOffer
          ? { NFTokenBuyOffer: body.NFTokenBuyOffer }
          : { NFTokenSellOffer: offerIndex || body.NFTokenSellOffer })
      };
    case "cancelSale":
    case "cancelSend":
    case "cancelOffer":
      return {
        TransactionType: "NFTokenCancelOffer",
        Account: account,
        NFTokenOffers: [offerIndex || body.offerId].filter(Boolean)
      };
    case "burn":
      return {
        TransactionType: "NFTokenBurn",
        Account: account,
        NFTokenID: nftId
      };
    case "send":
      return {
        TransactionType: "NFTokenCreateOffer",
        Account: account,
        NFTokenID: nftId,
        Amount: "0",
        Destination: dest,
        Flags: 1
      };
    case "trustset":
      return {
        TransactionType: "TrustSet",
        Account: account,
        LimitAmount: {
          currency: encodeCurrency(body.currency),
          issuer: body.issuer,
          value: String(body.limit || "1000000000")
        }
      };
    default:
      return body.txjson || { TransactionType: "SignIn" };
  }
}

export function shapeCreated(created = {}) {
  const uuid = created.uuid || created.uuidv4 || "";
  const qr = created.refs?.qr_png || created.qr_png || (uuid ? `${SIGN_URL}/${uuid}_q.png` : "");
  const next = created.next?.always || created.next_url || (uuid ? `${SIGN_URL}/${uuid}` : "");
  return {
    success: true,
    implemented: true,
    configured: true,
    uuid,
    message: qr,
    forMobile: uuid,
    qr_url: qr,
    next_url: next,
    next,
    pushed: Boolean(created.pushed)
  };
}

export function payloadState(payload) {
  const meta = payload?.meta || {};
  if (meta.signed === true) return "signed";
  if (meta.cancelled === true) return "cancelled";
  if (meta.expired === true) return "expired";
  if (payload?.response?.dispatched_result === "tec" || meta.resolved === true && meta.signed === false) {
    return "rejected";
  }
  return "pending";
}

export function statusHttp(state) {
  if (state === "signed" || state === "completed") return 200;
  if (state === "pending") return 202;
  return 400;
}

export function rememberPayload(store, record) {
  store.xumms = store.xumms || [];
  const row = {
    createdAt: new Date().toISOString(),
    status: "pending",
    ...record
  };
  const existing = store.xumms.find((item) => item.uuid === row.uuid);
  if (existing) Object.assign(existing, row);
  else store.xumms.unshift(row);
  store.xumms = store.xumms.slice(0, 400);
  return existing || store.xumms[0];
}

export function findPayload(store, uuid) {
  return (store.xumms || []).find((row) => row.uuid === uuid) || null;
}

export function ensureFreeProfile(store, address, extra = {}) {
  if (!address) return null;
  store.profiles = store.profiles || [];
  let profile = store.profiles.find((row) => row.wAddress === address);
  if (!profile) {
    profile = {
      _id: `profile-${address}`,
      wAddress: address,
      pName: extra.pName || `Xaman ${address.slice(0, 8)}`,
      isActive: true,
      vPoint: 0,
      createdAt: new Date().toISOString(),
      source: "xaman"
    };
    store.profiles.push(profile);
  }
  return profile;
}

export function applySignedIntent(store, record = {}, signed = {}) {
  const account = signed.account || record.account || "";
  const txid = signed.txid || "";
  const nftId = record.nftId || record._id;
  const kind = record.kind || "connect";
  let applied = { ok: true, kind, skipped: false };

  if (kind === "connect" || kind === "register" || kind === "signin") {
    ensureFreeProfile(store, account);
    applied = { ok: true, kind, profile: true };
  } else if (kind === "sale" && nftId) {
    applied = listForSale(store, {
      nftId,
      amount: record.amount,
      currency: record.currency,
      seller: account
    });
  } else if (kind === "cancelSale" && nftId) {
    applied = delist(store, { nftId });
  } else if (kind === "buy" && nftId) {
    applied = buyNow(store, { nftId, buyer: account });
  } else if (kind === "burn" && nftId) {
    applied = burnNft(store, { nftId, from: account });
  } else if (kind === "makeOffer") {
    applied = placeOffer(store, {
      nftId,
      from: account,
      amount: record.amount,
      currency: record.currency,
      issuer: record.issuer
    });
  } else if (kind === "acceptOffer" && (record.offerId || record.nftOfferIndex)) {
    applied = acceptOffer(store, record.offerId || record.nftOfferIndex, account);
  } else if (kind === "cancelOffer" && (record.offerId || record.nftOfferIndex)) {
    applied = cancelOffer(store, record.offerId || record.nftOfferIndex);
  } else if (kind === "send" && nftId && record.destAdd) {
    const nft = resolveNft(store, nftId);
    if (nft && !nft.virtual) {
      const row = (store.nfts || []).find((item) => item._id === nft._id);
      if (row) {
        row.accountNumber = record.destAdd;
        row.status = "minted";
      }
    }
    applied = { ok: true, kind, destAdd: record.destAdd };
  } else if (kind === "mint" && nftId) {
    const row = (store.nfts || []).find((item) => item._id === nftId);
    if (row) {
      row.isMinted = true;
      row.status = row.status === "sale" ? "sale" : "minted";
      row.ledgerTx = txid;
    }
    applied = { ok: true, kind, minted: true };
  }

  const saved = findPayload(store, record.uuid);
  if (saved) {
    saved.status = "signed";
    saved.signedAt = new Date().toISOString();
    saved.txid = txid;
    saved.account = account;
  }
  return { ...applied, txid, account };
}

export async function xummRequest(path, { method = "GET", body, fetchImpl = fetch } = {}) {
  if (!xamanConfigured()) {
    return { ok: false, configured: false, error: notConfigured().message };
  }
  const res = await fetchImpl(`${XUMM_API}${path}`, {
    method,
    headers: xummHeaders(),
    body: body == null ? undefined : JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error || data.error_reference) {
    return {
      ok: false,
      configured: true,
      status: res.status,
      error: data.error?.message || data.message || data.error || `Xaman ${res.status}`,
      data
    };
  }
  return { ok: true, configured: true, data };
}

export async function createPayload(txjson, { options = {}, custom_meta, fetchImpl = fetch } = {}) {
  return xummRequest("/payload", {
    method: "POST",
    body: {
      txjson,
      options: {
        submit: txjson?.TransactionType !== "SignIn",
        expire: 5,
        return_url: {
          web: process.env.XAMAN_RETURN_URL || "",
          app: process.env.XAMAN_RETURN_URL || ""
        },
        ...options
      },
      custom_meta: custom_meta || {
        instruction: "FUZION-XIO"
      }
    },
    fetchImpl
  });
}

export async function getPayload(uuid, { fetchImpl = fetch } = {}) {
  return xummRequest(`/payload/${uuid}`, { fetchImpl });
}

export async function cancelPayload(uuid, { fetchImpl = fetch } = {}) {
  return xummRequest(`/payload/${uuid}`, { method: "DELETE", fetchImpl });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForSigned(uuid, { timeoutMs = 50000, intervalMs = 2000, fetchImpl = fetch } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const got = await getPayload(uuid, { fetchImpl });
    if (!got.ok) return { ok: false, state: "error", error: got.error, payload: got.data };
    const state = payloadState(got.data);
    if (state === "signed") {
      return {
        ok: true,
        state,
        payload: got.data,
        account: got.data.response?.account || "",
        txid: got.data.response?.txid || ""
      };
    }
    if (state !== "pending") {
      return { ok: false, state, payload: got.data };
    }
    await sleep(intervalMs);
  }
  return { ok: false, state: "timeout" };
}

export function linesToCurrency(info, lines) {
  const drops = Number(info?.result?.account_data?.Balance || 0);
  const xrp = Number.isFinite(drops) ? +(drops / 1_000_000).toFixed(6) : 0;
  const currency = [{ currency: "XRP", value: String(xrp) }];
  for (const line of lines?.result?.lines || []) {
    currency.push({
      currency: line.currency?.length > 3 ? line.currency : line.currency,
      value: String(line.balance ?? "0"),
      issuer: line.account
    });
  }
  return currency;
}

export async function balancesForAccount(address) {
  if (!address) {
    return { success: true, account: "", currency: [{ currency: "XRP", value: "0" }] };
  }
  const [info, lines] = await Promise.all([
    accountInfo(address).catch(() => ({ ok: false })),
    accountLines(address).catch(() => ({ ok: false }))
  ]);
  const currency = linesToCurrency(info.ok ? info : { result: {} }, lines.ok ? lines : { result: { lines: [] } });
  return {
    success: true,
    account: address,
    currency
  };
}

export function nftTokenId(store, body = {}) {
  const id = body._id || body.nftId || body.Id;
  if (!id) return { nft: null, NFTokenID: body.NFTokenID || "" };
  const nft = resolveNft(store, id);
  return {
    nft,
    NFTokenID: body.NFTokenID || nft?.NFTokenID || ""
  };
}
