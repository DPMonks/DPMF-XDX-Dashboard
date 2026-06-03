import pg from "pg";
import { config } from "./config.js";

const pool = new pg.Pool({
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  port: config.db.port,
  ssl: { rejectUnauthorized: false }
});

export default pool;
