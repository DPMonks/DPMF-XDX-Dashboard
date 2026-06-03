export const config = {
  // XRPL Mainnet WebSocket endpoint
  xrplWs: "wss://xrplcluster.com",

  // Verified XDX issuer (Mainnet)
  xdxIssuer: "rMJAXYsbNzhwp7FYrNaSYP5ty3R9XnurPo",

  // Token codes
  xdxCurrency: "XDX",

  // LP token code (not used in AMM request)
  lpCurrency: "XDXLP",

  // Sync intervals (ms)
  ammSyncInterval: 60000,      // 1 minute
  holdersSyncInterval: 120000, // 2 minutes
  lpSyncInterval: 120000       // 2 minutes
};
