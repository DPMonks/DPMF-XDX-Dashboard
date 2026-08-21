# Indexer ask: recorded XDX USD price + native trustlines

Dashboard PR: https://github.com/DPMonks/DPMF-XDX-Dashboard/pull/4  
Indexer branch: `cursor/xdx-efficient-indexer-34cb` (agent `bc-60e38650-09f1-4dfa-a24d-0c2edee634cb`)  
Owners are done in indexer PR #5. **Price + trustlines are not.**

Dashboard is **SELECT-only**. Do not start or reset workers from there.

## 1. Recorded XDX price (8 decimal USD)

The dashboard shows Price / XDX/XRP as **USD per 1 XDX** with 8 decimals (`0.00000000`). Market caps stay `$0.00` dollars and are `supply ×` that recorded price.

Worker 2 already computes `xdxUsd = (reserve_currency / reserve_asset) * xrpUsd` and writes `price_latest.xdx_usd`, `price_latest_all` (`currency='XDX'`), and `price_history` (`asset='XDX'`). Keep that unit.

Live `/api/prices` still does this when `xdx_usd` is missing:

```js
xdxUsd = Number(xdx.price_usd || 0) || (xrpUsd ? xrpUsd * 0.000001 : 0)
```

**Delete that fallback.** `price_latest.price_usd` is XRP USD, not XDX. The dashboard now rejects `xrpUsd * 0.000001`.

Please serve:

```
GET /api/prices
```

```json
{
  "xrpUsd": 1.36,
  "xdxUsd": 0.00002946,
  "recorded_price": 0.00002946,
  "xdxGbp": 0.000023,
  "source": "db"
}
```

Rules:

- `xdxUsd` / `recorded_price` = **USD per 1 XDX**, at least 8 decimal places.
- Do **not** send AMM `price` (XRP per XDX) as `xdxUsd`.
- Persist `asset='XDX'` / `xdx_usd` in that same USD-per-XDX unit.
- Keep XDX/XRP AMM reserves populated: `reserve_asset` = XDX units, `reserve_currency` = XRP (not drops, not 0).
- `GET /api/sparkline/XDX` points must use `price_usd` as USD per XDX.

Redeploy **API first**, then **Worker 1**, then **Worker 2**, then **Worker 4**. Do not start them together. Until Worker 2 writes a real XDX USD row, price can still be `$0.00000000` if the live AMM row still has XRP reserve 0.

## 2. Native XDX trustlines (not the same as holders)

Worker 4 still skips `balance <= 0`, so trustlines == holders.

**Holders** = wallets with XDX `balance > 0`.  
**Trustlines** = every wallet with an XDX line, **including 0**.

They must be different counts. Do not copy `holder_count` into `trustlines`.

Keep 0-balance lines in latest/history (or a dedicated table), and serve:

```
GET /api/trustlines/count
{ "count": 312, "as_of": "2026-08-21T20:15:00.000Z" }

GET /api/charts/trustlines
[{ "timestamp": "2026-08-21T20:15:00.000Z", "trustline_count": 312 }]
```

Add those paths to `GET /`. Overview should send `trustline_count` separately from `holder_count`.

`GET /api/holders/count?snapshot=today` stays **owners only**. Trustline count includes zeros.

## Already shipped (owners)

`TODAY_OWNERS.md` / indexer PR #5:  
`GET /api/top-holders?snapshot=today` — same-UTC-day scan, `balance > 0`, one timestamp per cycle.

Auth: none. `accept: application/json`. No `/api/cluster/v1/*`.
