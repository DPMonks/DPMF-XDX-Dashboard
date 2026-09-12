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
  placeOffer,
  pushActivity
} from "./market.js";
import { signedMark, xrplMemos } from "./tradeMarker.js";
import {
  extractTxHash,
  isFreshXamanCreate,
  settleDecision,
  shouldRetryXaman,
  statusHttp as settleHttp
} from "./xamanSettle.js";
import { validateSignedIntent, xamanUserError } from "./xamanPrepare.js";
import { stampTradeTxjson, xamanSignIdentifier } from "../../fuzion-xio/src/helper/signMarker.js";
import { accountInfo, accountLines, txByHash } from "./xrpl.js";

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

export function fuzionReturnUrl() {
  const base = String(process.env.XAMAN_RETURN_URL || "http://127.0.0.1:5174").replace(/\/$/, "");
  if (base.includes("{id}")) return base;
  return `${base}/?xaman={id}`;
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
  let txjson;

  switch (kind) {
    case "connect":
    case "register":
    case "signin":
      return { TransactionType: "SignIn" };
    case "mint":
      txjson = {
        TransactionType: "NFTokenMint",
        Account: account,
        URI: toHex(body.uri || body.image || body.URL || ""),
        Flags: 8,
        TransferFee: transferFeeFromBps(body.royaltyBps || body.TransferFee || DEFAULT_ROYALTY_BPS),
        NFTokenTaxon: Number(body.taxon || body.NFTokenTaxon || 0)
      };
      break;
    case "sale":
      txjson = {
        TransactionType: "NFTokenCreateOffer",
        Account: account,
        NFTokenID: nftId,
        Amount: amountForXrpl(body),
        Flags: 1
      };
      break;
    case "buy":
    case "makeOffer":
      txjson = {
        TransactionType: "NFTokenCreateOffer",
        Account: account,
        NFTokenID: nftId,
        Amount: amountForXrpl(body),
        ...(body.Owner || body.nft_owner ? { Owner: body.Owner || body.nft_owner } : {})
      };
      break;
    case "acceptOffer":
      txjson = {
        TransactionType: "NFTokenAcceptOffer",
        Account: account,
        ...(body.NFTokenBuyOffer
          ? { NFTokenBuyOffer: body.NFTokenBuyOffer }
          : { NFTokenSellOffer: offerIndex || body.NFTokenSellOffer })
      };
      break;
    case "cancelSale":
    case "cancelSend":
    case "cancelOffer":
      txjson = {
        TransactionType: "NFTokenCancelOffer",
        Account: account,
        NFTokenOffers: [offerIndex || body.offerId].filter(Boolean)
      };
      break;
    case "burn":
      txjson = {
        TransactionType: "NFTokenBurn",
        Account: account,
        NFTokenID: nftId
      };
      break;
    case "send":
      txjson = {
        TransactionType: "NFTokenCreateOffer",
        Account: account,
        NFTokenID: nftId,
        Amount: "0",
        Destination: dest,
        Flags: 1
      };
      break;
    case "trustset":
      txjson = {
        TransactionType: "TrustSet",
        Account: account,
        LimitAmount: {
          currency: encodeCurrency(body.currency),
          issuer: body.issuer,
          value: String(body.limit || "1000000000")
        }
      };
      break;
    default:
      txjson = body.txjson || { TransactionType: "SignIn" };
  }
  if (!txjson || txjson.TransactionType === "SignIn") return txjson;
  return stampTradeTxjson({ ...txjson, ...xrplMemos({ kind }) }).txjson;
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
    websocket: created.refs?.websocket_status || "",
    pushed: Boolean(created.pushed),
    signMarker: created.signMarker || ""
  };
}

export function payloadState(payload, kind = "") {
  return settleDecision(kind, payload).status;
}

export function statusHttp(state) {
  return settleHttp(state);
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
  const existing = findPayload(store, record.uuid);
  if (existing?.appliedAt) {
    return {
      ok: true,
      kind: existing.kind || record.kind,
      skipped: true,
      already: true,
      txid: existing.txid,
      account: existing.account
    };
  }
  const account = signed.account || record.account || "";
  const txid = signed.txid || "";
  const nftId = record.nftId || record._id;
  const kind = record.kind || "connect";
  const mark = signedMark({ txid });
  let applied = { ok: true, kind, skipped: false };

  if (kind === "connect" || kind === "register" || kind === "signin") {
    ensureFreeProfile(store, account);
    applied = { ok: true, kind, profile: true };
  } else if (kind === "sale" && nftId) {
    applied = listForSale(store, {
      nftId,
      amount: record.amount,
      currency: record.currency,
      seller: account,
      ...mark
    });
  } else if (kind === "cancelSale" && nftId) {
    applied = delist(store, { nftId, ...mark });
  } else if (kind === "buy" && nftId) {
    applied = buyNow(store, { nftId, buyer: account, ...mark });
  } else if (kind === "burn" && nftId) {
    applied = burnNft(store, { nftId, from: account, ...mark });
  } else if (kind === "makeOffer") {
    applied = placeOffer(store, {
      nftId,
      from: account,
      amount: record.amount,
      currency: record.currency,
      issuer: record.issuer,
      ...mark
    });
  } else if (kind === "acceptOffer" && (record.offerId || record.nftOfferIndex)) {
    applied = acceptOffer(store, record.offerId || record.nftOfferIndex, account, mark);
  } else if (kind === "cancelOffer" && (record.offerId || record.nftOfferIndex)) {
    applied = cancelOffer(store, record.offerId || record.nftOfferIndex, {
      from: account,
      ...mark
    });
  } else if (kind === "send" && nftId && record.destAdd) {
    const nft = resolveNft(store, nftId);
    if (nft && !nft.virtual) {
      const row = (store.nfts || []).find((item) => item._id === nft._id);
      if (row) {
        row.accountNumber = record.destAdd;
        row.status = "minted";
      }
    }
    pushActivity(store, {
      type: "send",
      nftId,
      from: account,
      to: record.destAdd,
      ...mark
    });
    applied = { ok: true, kind, destAdd: record.destAdd };
  } else if (kind === "mint" && nftId) {
    const row = (store.nfts || []).find((item) => item._id === nftId);
    if (row) {
      row.isMinted = true;
      row.status = row.status === "sale" ? "sale" : "minted";
      row.ledgerTx = txid;
      Object.assign(row, mark);
    }
    pushActivity(store, {
      type: "mint",
      nftId,
      name: row?.name,
      from: account,
      ...mark
    });
    applied = { ok: true, kind, minted: true };
  }

  const saved = findPayload(store, record.uuid);
  if (saved?.appliedAt) {
    return { ok: true, kind, skipped: true, already: true, txid: saved.txid, account: saved.account };
  }
  if (saved) {
    saved.status = "signed";
    saved.signedAt = new Date().toISOString();
    saved.appliedAt = new Date().toISOString();
    saved.txid = txid;
    saved.account = account;
  }
  return { ...applied, txid, account };
}

export async function xummRequest(path, { method = "GET", body, fetchImpl = fetch, retries = 3 } = {}) {
  if (!xamanConfigured()) {
    return { ok: false, configured: false, error: notConfigured().message };
  }
  let last = { ok: false, configured: true, error: "Xaman request failed" };
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchImpl(`${XUMM_API}${path}`, {
        method,
        headers: xummHeaders(),
        body: body == null ? undefined : JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && !data.error && !data.error_reference) {
        return { ok: true, configured: true, data };
      }
      last = {
        ok: false,
        configured: true,
        status: res.status,
        error: xamanUserError(data, data.error?.message || data.message || `Xaman ${res.status}`),
        data
      };
      if (!shouldRetryXaman(res.status) || attempt === retries) return last;
    } catch (error) {
      last = { ok: false, configured: true, error: String(error.message || error) };
      if (attempt === retries) return last;
    }
    await sleep(300 * 2 ** attempt);
  }
  return last;
}

export function xamanAppSummary(ping = {}) {
  const app = ping.auth?.application || ping.application || {};
  return {
    pong: ping.pong === true,
    name: app.name || null,
    disabled: app.disabled === 1 || app.disabled === true
  };
}

export async function pingXaman({ fetchImpl = fetch } = {}) {
  return xummRequest("/ping", { method: "POST", body: {}, fetchImpl });
}

export async function createPayload(txjson, { options = {}, custom_meta, fetchImpl = fetch } = {}) {
  const stamped =
    txjson?.TransactionType && txjson.TransactionType !== "SignIn"
      ? stampTradeTxjson(txjson)
      : { txjson, marker: "" };
  const marker = stamped.marker || options.signMarker || "";
  const identifier = xamanSignIdentifier(marker);
  const created = await xummRequest("/payload", {
    method: "POST",
    body: {
      txjson: stamped.txjson,
      options: {
        submit: stamped.txjson?.TransactionType !== "SignIn",
        expire: 5,
        return_url: {
          web: fuzionReturnUrl(),
          app: fuzionReturnUrl()
        },
        ...options
      },
      custom_meta: {
        instruction: custom_meta?.instruction || "FUZION-XIO",
        ...(identifier
          ? {
              identifier,
              blob: {
                sign: true,
                marker,
                tx: stamped.txjson?.TransactionType || ""
              }
            }
          : {}),
        ...custom_meta
      }
    },
    fetchImpl
  });
  if (created.ok && !isFreshXamanCreate(created.data)) {
    return {
      ok: false,
      configured: true,
      status: 409,
      error: "Xaman returned a payload that was already signed. Start a new sign.",
      data: created.data,
      signMarker: marker
    };
  }
  return { ...created, signMarker: marker, txjson: stamped.txjson };
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

export async function confirmLedger(txid) {
  if (!isTxHashSafe(txid)) return null;
  const got = await txByHash(txid);
  return got.ok ? got.result : got;
}

function isTxHashSafe(value) {
  return /^[A-Fa-f0-9]{64}$/.test(String(value || "").trim());
}

export async function settlePayload(kind, payload, { confirm = true } = {}) {
  const hash = extractTxHash(payload);
  let ledger = null;
  if (confirm && hash) {
    ledger = await confirmLedger(hash);
  }
  return settleDecision(kind, payload, ledger);
}

export async function waitForSigned(uuid, { timeoutMs = 240000, intervalMs = 2000, fetchImpl = fetch, kind = "connect" } = {}) {
  const started = Date.now();
  let lastError = "";
  let lastState = "pending";
  while (Date.now() - started < timeoutMs) {
    const got = await getPayload(uuid, { fetchImpl });
    if (!got.ok) {
      lastError = got.error;
      lastState = "pending";
      await sleep(intervalMs);
      continue;
    }
    const settled = await settlePayload(kind, got.data);
    lastState = settled.status || "pending";
    if (settled.status === "completed") {
      return {
        ok: true,
        state: "signed",
        status: "completed",
        payload: got.data,
        account: settled.account || got.data.response?.account || "",
        txid: settled.txid || "",
        tesSuccess: settled.tesSuccess === true
      };
    }
    if (settled.status === "pending" || settled.status === "confirming") {
      await sleep(intervalMs);
      continue;
    }
    return { ok: false, state: settled.status, status: settled.status, payload: got.data, tesSuccess: false };
  }
  return { ok: false, state: lastState === "confirming" ? "confirming" : "timeout", status: lastState, error: lastError };
}

export { validateSignedIntent, xamanUserError };

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
