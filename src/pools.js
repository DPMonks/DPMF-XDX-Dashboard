// /src/pools.js

export default [
  {
    name: "XDX/XRP",
    issuer: "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo",     // XDX issuer
    amm_issuer: "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo", // AMM pool account (same for XLS-30)
    tokenA: "XDX",
    tokenB: "XRP",

    // LP token currency code (HEX)
    // LP tokens ALWAYS use 40‑byte HEX
    lp_currency_hex: "4C50580000000000000000000000000000000000"
  },

  {
    name: "XDX/RLUSD",
    issuer: "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo",     // XDX issuer
    amm_issuer: "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo", // AMM pool account
    tokenA: "XDX",
    tokenB: "RLUSD",

    // RLUSD LP token HEX (example placeholder)
    lp_currency_hex: "4C5058524C555344000000000000000000000000"
  }
];
