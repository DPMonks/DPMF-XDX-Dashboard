# XDX DEX + AMM order book

Dashboard PR: https://github.com/DPMonks/DPMF-XDX-Dashboard/pull/4
Indexer PR: https://github.com/DPMonks/dpmf-xdx-indexer/pull/5

Dashboard is **SELECT-only**. Do not call XRPL `book_offers`. Do not invent `/api/cluster/v1/*`. Do not start workers.

```
GET /api/orderbook?pair=XDX/XRP
GET /api/orderbook?quote=RLUSD
GET /api/orderbooks
```

SQL: `SELECT payload FROM order_book_latest WHERE pair = 'XDX/XRP'|'XDX/RLUSD'`.

`price` / bid / ask / mid are **quote per 1 XDX**. Chart stays on `/api/prices` `recorded_price`.
