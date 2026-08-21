# Recorded XDX USD price + native trustlines

Dashboard PR: https://github.com/DPMonks/DPMF-XDX-Dashboard/pull/4  
Indexer branch: `cursor/xdx-efficient-indexer-34cb`

Dashboard is **SELECT-only**. Do not start or reset workers. No new routes. SQL is enough if `x-dpmf-source: postgres`.

## Price is written and updating

Right now:

- `price_latest` `asset='XDX'` `price_usd` = **0.0000416**
- `xdx_usd` = **0.0000416** on every `price_latest` row (newest is XDX)
- `price_latest_all.currency='XDX'` `price_usd` = **0.0000416**
- `xrpUsd` ≈ 1.4

Frontend lock stays: Price = `xdxUsd` / `recorded_price` only (USD per 1 XDX, 8 decimals).

SQL:

```sql
SELECT xdx_usd FROM price_latest ORDER BY timestamp DESC LIMIT 1
-- and/or
SELECT price_usd FROM price_latest WHERE asset IN ('XDX','xdx')
```

Do **not** use AMM `price` (XRP per XDX). Do **not** use `reserve_currency` for the tile — old Worker 1 is still writing that as 0. Do **not** use `xrpUsd * 0.000001`. Caps = `10_000_000_000 * recorded_price`.

If Price is still `$0.00000000`, Vercel is not reading Postgres (`x-dpmf-source` must be `postgres`), or the tile is still bound to AMM price.

## Trustlines ≠ holders

`token_holders_latest` may be empty if an old `main` writer TRUNCATEs it. The same-time scan is in history:

- **19,983** trustlines (every line, including 0)
- **15,947** holders (`balance > 0`)
- latest history timestamp ~ `2026-08-21T21:45:22Z`

Tile = `GET /api/trustlines/count` or

```sql
SELECT COUNT(*) FROM token_holders_history
WHERE timestamp = (SELECT MAX(timestamp) FROM token_holders_history)
```

Do not `COUNT(*) WHERE balance > 0` for Trustlines. Do not copy `holder_count`. Chart = `GET /api/charts/trustlines` / `GROUP BY timestamp`.

Today-owners shape is locked (`TODAY_OWNERS.md`). Do not change it.

Confirm after refresh: Price ≈ **$0.00004160**, Trustlines **19983**, Holders **15947**.
