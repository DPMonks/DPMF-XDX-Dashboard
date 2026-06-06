import pg from "pg";

console.log("🔧 DB ENV:", {
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  database: process.env.PGDATABASE,
  port: process.env.PGPORT
});

// Create a stable, production-safe connection pool
const pool = new pg.Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT),
  ssl: { rejectUnauthorized: false },

  // Stability + performance tuning
  max: 5,                     // limit concurrent connections
  idleTimeoutMillis: 30000,   // close idle clients after 30s
  connectionTimeoutMillis: 2000 // fail fast if DB is unreachable
});

// Optional: log when pool connects a client
pool.on("connect", () => {
  console.log("✅ Postgres pool connected");
});

// Optional: log errors from the pool
pool.on("error", (err) => {
  console.error("❌ Unexpected Postgres error:", err);
});

export default pool;
