// Phase 2 (draft): read raw history for the recent window and hourly/daily
// rollups for older dates, so the indexer can trim raw rows without breaking
// 1M / 3M / 1Y / Max charts. Behind ROLLUP_READS=1; off by default.
// Rollup tables are written by the indexer retention job (phase 2 indexer PR):
//   price_history_hourly(asset, bucket, open, high, low, close, avg)
//   amm_pool_hourly(pool_name, bucket, reserve_asset, reserve_currency, price, lp_supply)
//   lp_holders_daily(pool_name, day, trustline_count, lp_holder_count, lp_supply)

export const ROLLUP_RAW_DAYS = { price: 90, amm: 90, lp: 30 };

export function rollupReadsEnabled(env = process.env) {
  return env.ROLLUP_READS === "1";
}

/** Newest-first raw window plus hourly closes before it, returned oldest-first. */
export function priceHistorySql(key) {
  return `
    SELECT timestamp, asset, price_usd FROM (
      SELECT timestamp, ${key} AS asset, price_usd
        FROM price_history
       WHERE ${key} IN ('XDX','xdx','XRP','xrp')
         AND timestamp >= now() - interval '${ROLLUP_RAW_DAYS.price} days'
      UNION ALL
      SELECT bucket AS timestamp, asset, close AS price_usd
        FROM price_history_hourly
       WHERE asset IN ('XDX','XRP')
         AND bucket < now() - interval '${ROLLUP_RAW_DAYS.price} days'
    ) s
    ORDER BY timestamp DESC
    LIMIT 20000`;
}

export function ammHistorySql() {
  return `
    SELECT timestamp, pool_name, reserve_asset, reserve_currency, price, lp_supply FROM (
      SELECT timestamp, pool_name, reserve_asset, reserve_currency, price, lp_supply
        FROM amm_pool_history
       WHERE pool_name IN ('XDX/XRP','XDX/RLUSD')
         AND timestamp >= now() - interval '${ROLLUP_RAW_DAYS.amm} days'
      UNION ALL
      SELECT bucket, pool_name, reserve_asset, reserve_currency, price, lp_supply
        FROM amm_pool_hourly
       WHERE pool_name IN ('XDX/XRP','XDX/RLUSD')
         AND bucket < now() - interval '${ROLLUP_RAW_DAYS.amm} days'
    ) s
    ORDER BY timestamp DESC
    LIMIT 20000`;
}

export function lpHoldersSeriesSql() {
  return `
    SELECT timestamp, trustline_count, lp_holder_count, lp_supply, pool_name FROM (
      SELECT timestamp,
             COUNT(*)::int AS trustline_count,
             COUNT(*) FILTER (WHERE ABS(lp_balance::numeric) > 0)::int AS lp_holder_count,
             COALESCE(SUM(ABS(lp_balance::numeric)), 0) AS lp_supply,
             COALESCE(pool_name, 'XDX/XRP') AS pool_name
        FROM lp_holders_history
       WHERE timestamp >= now() - interval '${ROLLUP_RAW_DAYS.lp} days'
       GROUP BY timestamp, COALESCE(pool_name, 'XDX/XRP')
      UNION ALL
      SELECT day::timestamp, trustline_count, lp_holder_count, lp_supply, pool_name
        FROM lp_holders_daily
       WHERE day < (now() - interval '${ROLLUP_RAW_DAYS.lp} days')::date
    ) s
    ORDER BY timestamp ASC`;
}

/** Rows come back newest-first for the LIMIT; charts want oldest-first. */
export function oldestFirst(rows) {
  return [...(rows || [])].reverse();
}
