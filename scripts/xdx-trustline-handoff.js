#!/usr/bin/env node
/**
 * XDX Trustline handoff for the indexer agent.
 *
 * The dashboard already creates this TrustSet through DPMF's Xaman API:
 *   POST /api/xaman/create-payload  { txjson: <below>, options: { submit: true } }
 *
 * After the user signs in Xaman, XRPL has a RippleState for issuer + XDX.
 * The next XRPL Node 3 token holder / trustline scan should pick it up.
 *
 * Do not start indexer workers from this script. Do not invent /api/cluster/v1/*.
 * Trustlines tile = every RippleState including 0, not holders with balance > 0.
 *
 * Run: node scripts/xdx-trustline-handoff.js
 */
import {
  XDX_CURRENCY,
  XDX_HEX,
  XDX_ISSUER,
  XDX_TOTAL_SUPPLY,
  XDX_TRUST_LIMIT,
  xdxTrustSetTxjson,
} from "../src/constants/ledger.js";

const handoff = {
  purpose: "Index a newly signed XDX TrustSet from the dashboard Xaman button",
  issuer: XDX_ISSUER,
  currency: XDX_CURRENCY,
  currencyHex: XDX_HEX,
  trustLimit: XDX_TRUST_LIMIT,
  totalSupply: XDX_TOTAL_SUPPLY,
  dashboard: {
    button: "XDX Trustline",
    endpoint: "POST /api/xaman/create-payload",
    xamanSubmit: true,
    txjson: xdxTrustSetTxjson(),
  },
  indexer: {
    liveApi: "https://dpmf-xdx-indexer-production.up.railway.app",
    doNotStartWorkers: true,
    doNotInventClusterV1: true,
    existingReads: [
      "GET /api/trustlines/count",
      "GET /api/charts/trustlines",
      "GET /api/holders/count",
    ],
    detectNewLine: {
      ledgerObjects: ["TrustSet", "RippleState"],
      match: {
        issuer: XDX_ISSUER,
        currency: [XDX_CURRENCY, XDX_HEX],
      },
      sqlHint:
        "COUNT(*) FROM token_holders_history WHERE timestamp = (SELECT MAX(timestamp) FROM token_holders_history) — include zero balances",
    },
    optionalFasterPath:
      "If the next Node 3 scan is too slow, watch account_tx / ledger stream for TrustSet + RippleState to the issuer and increment trustline_count. Do not COUNT only balance > 0.",
  },
};

console.log(JSON.stringify(handoff, null, 2));
