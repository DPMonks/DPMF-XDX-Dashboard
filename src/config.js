// config clean v2
export const config = {
  // XRPL WebSocket + RPC (Mainnet)
  xrplWs: "wss://xrplcluster.com",
  xrplRpc: "https://xrplcluster.com",

  // XDX Token Details (REAL on-ledger values)
  xdxIssuer: "rMJAXYsbNzhwp7FYrNaSYP5ty3R9XnurPo",
  xdxCurrency: "5844580000000000000000000000000000000000",  // XDX in 160-bit hex
  lpCurrency: "4C50580000000000000000000000000000000000",  // LP token (LPX) hex

  // PostgreSQL (Railway injects these automatically)
  db: {
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    port: process.env.PGPORT
  },

  // Sync intervals (ms)
  ammSyncInterval: 60000,
  holdersSyncInterval: 120000,
  lpSyncInterval: 120000
};
