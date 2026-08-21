# Indexer ask: recorded XDX USD price + native trustlines

Dashboard PR: https://github.com/DPMonks/DPMF-XDX-Dashboard/pull/4  
Dashboard is **SELECT-only**. Do not start or reset workers from there.

These two fields are still empty or wrong on the UI because the indexer is not writing them as the dashboard reads them.

## 1. Recorded XDX price (8 decimal USD)

The dashboard shows Price / XDX/XRP as **USD per 1 XDX** with 8 decimals (`0.00000000`). Market caps stay `$0.00` dollars and are `supply ×` that recorded price.

Please write and serve:

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

- `xdxUsd` / `recorded_price` = **USD per 1 XDX**, at least 8 decimal places. Example from the XDX/XRP AMM: `reserve_currency / reserve_asset * xrpUsd`.
- Do **not** send AMM `price` (XRP per XDX) as `xdxUsd`.
- Do **not** use live railway `price_usd * 0.000001` unless that is truly the USD price.
- Persist `price_latest` / `price_history` with `asset = 'XDX'` and `price_usd` in that same USD-per-XDX unit.
- Keep XDX/XRP AMM reserves populated: `reserve_asset` = XDX units, `reserve_currency` = XRP (not drops). `reserve_currency = 0` is why the dashboard shows `$0.00000000`.
- `GET /api/sparkline/XDX` points must use `price_usd` as USD per XDX, not XRP/USD.

Overview may also send `xdxUsd` and `recorded_price`. The dashboard will not treat AMM `price` as USD.

## 2. Native XDX trustlines (not the same as holders)

**Holders** = wallets with XDX `balance > 0`.  
**Trustlines** = every wallet with an XDX line, **including 0**.

They must be different counts. Do not copy `holder_count` into `trustlines`.

Please write 0-balance lines into `token_holders_latest` / `token_holders_history` (or a dedicated trustlines table), and serve:

```
GET /api/trustlines/count
{ "count": 312, "as_of": "2026-08-21T20:15:00.000Z" }

GET /api/charts/trustlines
[{ "timestamp": "2026-08-21T20:15:00.000Z", "trustline_count": 312 }]
```

Overview should send `trustline_count` separately from `holder_count`.

`GET /api/holders/count?snapshot=today` stays **owners only** (`balance > 0`). Trustline count includes zeros.

## Already asked (owners)

Today’s owner snapshot is in `TODAY_OWNERS.md`:  
`GET /api/top-holders?snapshot=today` — same-UTC-day scan, `balance > 0`, one timestamp per cycle.

Auth: none. `accept: application/json`. No `/api/cluster/v1/*`.
