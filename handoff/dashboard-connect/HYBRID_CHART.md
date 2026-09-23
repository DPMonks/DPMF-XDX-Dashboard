# Hybrid XDX chart (preview only)

Dashboard branch: `cursor/hybrid-chart-99bb`  
Do **not** merge to Production until this has been tested. Dexscreener stays one click away.

```
node scripts/lock-hybrid-candles.js
```

That script pulls history **once** into `src/data/lockedCandles.json`.

## Locked series

| Series | Source | Status |
|---|---|---|
| XRP/USD daily | Yahoo `XRP-USD` from 24 Oct 2021 | Locked |
| XDX/XRP daily | InFTF `GET /v1/iou/market_data/{issuer}_XDX/XRP?interval=1d` | Locked from first DEX print (10 Nov 2021) |
| XDX/RLUSD daily | `XDX/XRP × XRP/USD` (RLUSD ≈ $1) until native AMM prints exist | Built from the XDX/XRP lock |

Live candles still merge `/api/sparkline/XDX`, `/api/xdx-flows`, AMM spot, and order-book mid. Browser stays SELECT-only.

## XIO pairs (XIO/XRP, XIO/RLUSD)

The XDX lock does not include XIO-base pairs. The hybrid chart and Commander read them from the XIO exchange locked series, same-origin:

```
GET /api/chart/candles?pair=XIO/XRP
```

That handler proxies `https://xio-exchange.dpmf.technology/api/chart/candles` and merges `snapshot.pairs` for every XIO/* series in the lock (`t,o,h,l,c,v,source`). Optional env `XIO_EXCHANGE_ORIGIN` overrides the host. The default works with no env. Do not call XIO `/api/candles` (that path needs a database and is often 503). The function keeps the XIO snapshot in memory for about 5 minutes. A request for XDX/XRP does not call the XIO host and leaves the XDX series unchanged. No new database.

## Wallet marks

Order lines and fill dots render **only** when a wallet is signed in. They use that wallet’s book rows and `xdx-flows` prints. Ready for later order-placement lines at the entry date.

## Indexer

No new cluster routes. Optional SELECT (already used tables):

- `price_history` (full, not the 50-point sparkline)
- `amm_pool_history` for XDX/XRP and XDX/RLUSD

Do not start workers.
