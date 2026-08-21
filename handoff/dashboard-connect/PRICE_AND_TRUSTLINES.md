# Recorded XDX USD price + native trustlines

Dashboard PR: https://github.com/DPMonks/DPMF-XDX-Dashboard/pull/4  
Indexer branch: `cursor/xdx-efficient-indexer-34cb`

Dashboard is **SELECT-only**. Do not start or reset workers from there. Frontend contract is locked.

## Live Worker 4 scan

Trustlines **19,983** (every XDX line, including 0) and holders **15,947** (`balance > 0`) are in `token_holders_latest` and `token_holders_history`. Those are different counts.

## Price (Worker 2)

Tiles show only `xdxUsd` / `recorded_price` (USD per 1 XDX, 8 decimals). SQL order:

1. `price_latest.xdx_usd` (newest row)
2. `price_latest.price_usd WHERE asset IN ('XDX','xdx')`
3. `price_latest_all.price_usd WHERE currency = 'XDX'`
4. `price_history.price_usd WHERE asset = 'XDX'`

Ignore AMM `price` (XRP per XDX). Reject `xrpUsd * 0.000001`. `price_latest.price_usd` without an XDX asset filter is XRP USD.

Until Worker 2 logs `Prices written XRP=… XDX=0.00004…`, Price can still be `$0.00000000`.

## Trustlines

- Tile: `GET /api/trustlines/count` → `{ count, as_of }`
- SQL: `COUNT(*)` on `token_holders_latest`, else the latest `token_holders_history` timestamp (all rows, including 0)
- Chart: `GET /api/charts/trustlines` → `[{ timestamp, trustline_count }]`
- Do **not** copy `holder_count` into the Trustlines tile

`GET /api/holders/count?snapshot=today` and `GET /api/top-holders?snapshot=today` stay owners only (`TODAY_OWNERS.md`). Do not change that shape.

## Empty cards

If tiles are still empty after this scan, the gap is Vercel `DATABASE_URL` / SSL (`x-dpmf-source` must be `postgres` on `/api/overview`), not missing indexer writes.

Redeploy API, then Worker 1, then Worker 2, then Worker 4. Do not start them together.

Auth: none. `accept: application/json`. No `/api/cluster/v1/*`.
