// On-ledger constants from the indexer handoff. The old AMM rDgGyBao… is a voter, not the pool.

export const XDX_ISSUER = "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo";
export const XDX_CURRENCY = "XDX";
export const XDX_HEX = "5844580000000000000000000000000000000000";
export const XDX_TOTAL_SUPPLY = 10_000_000_000;
export const XDX_ISSUED_AT = "2021-10-24T13:31:20.000Z";
export const XDX_XRPL_TO_MD5 = "20bb6167c0c9809d91d0bba2e1e888cd";

export function issuerLockedFromIssued(issued, total = XDX_TOTAL_SUPPLY) {
  const out = Number(issued);
  if (!Number.isFinite(out) || out <= 0) return 0;
  return Math.max(0, Math.round((total - out) * 1e8) / 1e8);
}

export const XDX_XRP_AMM = "rhEwhutV5EyYzTbBYDdK7dHxwdi5omqffB";
export const XDX_XRP_LP_HEX = "03970105D80AE3C54085F6E97EE16CEDE6CE8200";
export const XDX_XRP_LP_XRPL_TO_MD5 = "fb3abb3a776efbefe9a558705fe52606";

// tfSetNoRipple — standard IOU trustline so the line cannot ripple.
export const TF_SET_NO_RIPPLE = 131072;
export const XDX_TRUST_LIMIT = String(XDX_TOTAL_SUPPLY);

export function xdxTrustSetTxjson(account) {
  const txjson = {
    TransactionType: "TrustSet",
    Flags: TF_SET_NO_RIPPLE,
    LimitAmount: {
      currency: XDX_CURRENCY,
      issuer: XDX_ISSUER,
      value: XDX_TRUST_LIMIT,
    },
  };
  const signer = String(account || "").trim();
  if (signer) txjson.Account = signer;
  return txjson;
}

export const RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
export const RLUSD_HEX = "524C555344000000000000000000000000000000";
export const XDX_RLUSD_AMM = "rLbBzF9oxntVf4XxcyakNKJTci4yqSmQUu";
export const XDX_RLUSD_LP_HEX = "03BCD44104644B711C58CD14CD13CBA65757CFBE";
export const XDX_RLUSD_LP_XRPL_TO_MD5 = "21c0d4ee52560f17adc52b9bdc3c6770";
export const XRP_XRPL_TO_MD5 = "84e5efeb89c4eae8f68188982dc290d8";

export function xrplToMd5ForLpPool(pool) {
  const name = String(pool || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "/");
  if (name.includes("RLUSD") || name === XDX_RLUSD_AMM.toUpperCase()) {
    return XDX_RLUSD_LP_XRPL_TO_MD5;
  }
  return XDX_XRP_LP_XRPL_TO_MD5;
}

export const XIO_ISSUER = "rfuzioNFTKArnU1PQD5BEF272vpbHMRoxU";
export const XSQUAD_ISSUER = "roBYiFtZsTRpWEUw6TtpUCwZCfjcQeRBg";

export function asciiCurrencyHex(code) {
  const text = String(code || "");
  let hex = "";
  for (let i = 0; i < text.length; i += 1) {
    hex += text.charCodeAt(i).toString(16).toUpperCase().padStart(2, "0");
  }
  return hex.padEnd(40, "0");
}

export const XIO_HEX = asciiCurrencyHex("XIO");
export const XSQUAD_HEX = asciiCurrencyHex("XSQUAD");

export const POOLS = [
  {
    pair: "XDX/XRP",
    amm: XDX_XRP_AMM,
    lpHex: XDX_XRP_LP_HEX,
    asset: "XDX",
    quote: "XRP",
  },
  {
    pair: "XDX/RLUSD",
    amm: XDX_RLUSD_AMM,
    lpHex: XDX_RLUSD_LP_HEX,
    asset: "XDX",
    quote: "RLUSD",
    quoteIssuer: RLUSD_ISSUER,
    quoteHex: RLUSD_HEX,
  },
];

export function pairFromRow(row = {}) {
  const named = row.pair || row.pool || row.pool_name || row.poolName || row.name;
  if (named && String(named).includes("/")) {
    return String(named).replace(/\s+/g, "").toUpperCase();
  }
  if (named) return String(named);

  const haystack = [
    row.amm,
    row.amm_account,
    row.amm_issuer,
    row.lp_issuer,
    row.issuer,
    row.currency,
    row.lp_currency,
    row.lp_currency_hex,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  const quoteHint = [row.quote, row.quote_hex, row.quote_issuer, row.asset2]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
  const look = `${haystack} ${quoteHint}`;

  if (look.includes(XDX_RLUSD_AMM.toUpperCase()) || look.includes(XDX_RLUSD_LP_HEX)) {
    return "XDX/RLUSD";
  }
  if (look.includes(XDX_XRP_AMM.toUpperCase()) || look.includes(XDX_XRP_LP_HEX)) {
    return "XDX/XRP";
  }
  if (look.includes(XSQUAD_ISSUER.toUpperCase()) || look.includes(XSQUAD_HEX) || look.includes("XSQUAD")) {
    return "XDX/XSQUAD";
  }
  if (look.includes(XIO_ISSUER.toUpperCase()) || look.includes(XIO_HEX) || /(^|\s)XIO(\s|$)/.test(look)) {
    return "XDX/XIO";
  }
  if (look.includes("RLUSD") || look.includes(RLUSD_HEX)) {
    return "XDX/RLUSD";
  }

  const amm = row.amm_account || row.amm;
  if (amm && String(amm).length >= 8) {
    const text = String(amm);
    return `XDX/${text.slice(0, 4)}…${text.slice(-4)}`;
  }
  const lpHex = String(row.lp_currency || row.lp_currency_hex || "").replace(/^0x/i, "").toUpperCase();
  if (/^03[A-F0-9]{38}$/.test(lpHex) && lpHex !== XDX_XRP_LP_HEX && lpHex !== XDX_RLUSD_LP_HEX) {
    return "";
  }
  return "XDX/XRP";
}
