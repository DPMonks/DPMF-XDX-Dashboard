import pg from "pg";

console.log("DB ENV:", {
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  database: process.env.PGDATABASE,
  port: process.env.PGPORT
});

const pool = new pg.Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT),
  ssl: { rejectUnauthorized: false }
});

// Test connection
pool.connect()
  .then(() => console.log("✅ Connected to Postgres"))
  .catch(err => {
    console.error("❌ Postgres connection error:", err);
  });

export default pool;
