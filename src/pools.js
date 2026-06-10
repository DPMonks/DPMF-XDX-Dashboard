// /src/pools.js

export default [
  {
    name: "XDX/XRP",
    issuer: "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo",     // XDX token issuer
    amm_issuer: "rDgGyBaoZ66q5gGzK3hYb2qviT6RXGiWSC", // XDX/XRP AMM pool account
    tokenA: "XDX",
    tokenB: "XRP",

    // LP token currency code (40‑byte HEX)
    lp_currency_hex: "03970105D80AE3C54085F6E97EE16CEDE6CE8200"
  },

  {
    name: "XDX/RLUSD",
    issuer: "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo",     // XDX token issuer
    amm_issuer: "rBKRjtYdxJkFdnbbk2u2JWh4ZUyszGXrTR", // XDX/RLUSD AMM pool account
    tokenA: "XDX",
    tokenB: "RLUSD",

    // RLUSD LP token HEX (40‑byte)
    lp_currency_hex: "524C555344000000000000000000000000000000"
  }
];
