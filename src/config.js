export const config = {
  // XRPL WebSocket + RPC (Mainnet)
  xrplWs: "wss://xrplcluster.com",       // WebSocket for live data
  xrplRpc: "https://xrplcluster.com",    // HTTPS RPC for account_lines, AMM, etc.

  // XDX Token Details
  xdxIssuer: "rMJAXYsbNzhwp7FYrNaSYP5ty3R9XnurPo",
  xdxCurrency: "XDX",
  lpCurrency: "XDXLP",

  // PostgreSQL (Railway injects these automatically)
  db: {
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    port: process.env.PGPORT
  },

  // Sync intervals (ms)
  ammSyncInterval: 60000,      // 1 minute
  holdersSyncInterval: 120000, // 2 minutes
  lpSyncInterval: 120000       // 2 minutes
};
