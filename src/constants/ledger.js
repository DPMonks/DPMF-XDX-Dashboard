// On-ledger constants from the indexer handoff. The old AMM rDgGyBao… is a voter, not the pool.

export const XDX_ISSUER = "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo";
export const XDX_CURRENCY = "XDX";
export const XDX_HEX = "5844580000000000000000000000000000000000";
export const XDX_TOTAL_SUPPLY = 10_000_000_000;

export const XDX_XRP_AMM = "rhEwhutV5EyYzTbBYDdK7dHxwdi5omqffB";
export const XDX_XRP_LP_HEX = "03970105D80AE3C54085F6E97EE16CEDE6CE8200";

export const RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
export const RLUSD_HEX = "524C555344000000000000000000000000000000";
export const XDX_RLUSD_AMM = "rLbBzF9oxntVf4XxcyakNKJTci4yqSmQUu";
export const XDX_RLUSD_LP_HEX = "03BCD44104644B711C58CD14CD13CBA65757CFBE";

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

  if (haystack.includes(XDX_RLUSD_AMM.toUpperCase()) || haystack.includes(XDX_RLUSD_LP_HEX)) {
    return "XDX/RLUSD";
  }
  if (haystack.includes(XDX_XRP_AMM.toUpperCase()) || haystack.includes(XDX_XRP_LP_HEX)) {
    return "XDX/XRP";
  }
  if (haystack.includes("RLUSD") || haystack.includes(RLUSD_HEX)) {
    return "XDX/RLUSD";
  }

  const amm = row.amm_account || row.amm;
  if (amm && String(amm).length >= 8) {
    const text = String(amm);
    return `XDX/${text.slice(0, 4)}…${text.slice(-4)}`;
  }
  return "XDX/XRP";
}
