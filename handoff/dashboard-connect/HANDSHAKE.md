# Cluster v1 handshake — dashboard ↔ indexer

This file is the dashboard-side copy of the cluster v1 handshake. The indexer
agent publishes the same contract at
`handoff/dashboard-connect/HANDSHAKE.md` on
`cursor/tie-dashboard-clusterv1-2567`.

The browser never talks to the XRPL and never calls Railway directly.
Vite (dev) and Vercel (preview/production) proxy same-origin `/api/*`
(except `/api/xaman/*`) to the indexer and retry HTTP 429.

## Identity

| Field | Value |
| --- | --- |
| protocol | `clusterv1` |
| version | `1` |
| client | `dpmf-xdx-dashboard` |
| service | `dpmf-xdx-indexer` |
| origin | `https://dpmf-xdx-indexer-production.up.railway.app` |

Every proxied request sends:

```
accept: application/json
x-dpmf-client: dpmf-xdx-dashboard
x-cluster-protocol: clusterv1
x-cluster-version: 1
```

## Handshake probe order

The dashboard first applies the bundled route table below, then tries a live
handshake. A live 200 can override paths and optionally include a snapshot so
cards paint before the first paginated fetch.

Same-origin (browser):

1. `GET` then `POST /api/cluster/v1/handshake`
2. `/api/cluster/handshake`
3. `/api/v1/handshake`
4. `/api/handshake`
5. `/api/public/handshake`
6. catalog `GET /api/`

The Vercel/Vite proxy also tries indexer aliases `/cluster/v1/handshake` and
`/handshake` so a raw rewrite is not required.

`POST` body:

```json
{
  "client": "dpmf-xdx-dashboard",
  "protocol": "clusterv1",
  "version": 1
}
```

Accepted live handshake fields (any one is enough):

`protocol`, `cluster`, `version`, `endpoints` / `routes`, `snapshot` /
`data` / `payload` / `tables`, `ok`, `service`, `overview`, `pools`.

## Bundled routes (INDEXER_CONNECT)

All paths are relative to `/api`.

| Need | GET |
| --- | --- |
| Overview | `/overview` (alias `/public/overview`) |
| AMM | `/amm` (alias `/public/amm`) |
| Pools | `/pools` → `{ ...primary, pools: [...] }` |
| Holders | `/top-holders?limit=&offset=` (`/top-holders-v2` same) |
| LP holders | `/top-lp?limit=&offset=` field is `lp_balance` |
| Counts | `/holders/count` `/lp-holders/count` |
| Charts | `/charts/tvl` `/charts/holders` `/charts/lp-holders` |
| Wallet | `/wallet/balances/:address` also `/balances/:address` |
| Net worth | `/wallet/networth/:address` |
| Prices | `/prices` `/prices/change24h` `/sparkline/XRP\|XDX\|LP` |

Not on the indexer: `/api/lp/:wallet`, `/api/xaman/*`. Xaman stays on this repo.

## Snapshot (optional)

If the handshake includes a snapshot, those rows render immediately:

```json
{
  "ok": true,
  "protocol": "clusterv1",
  "version": 1,
  "service": "dpmf-xdx-indexer",
  "endpoints": {},
  "snapshot": {
    "overview": {},
    "pools": [],
    "holders": [],
    "lpHolders": [],
    "charts": { "tvl": [], "holders": [], "lpHolders": [] },
    "prices": {},
    "change24h": {}
  }
}
```

Otherwise the dashboard loads first pages sequentially (holders → LP → AMM)
and never opens `wss://s1.ripple.com`.

## On-ledger constants

The old AMM `rDgGyBao…` is a voter, not the pool.

| Item | Value |
| --- | --- |
| XDX issuer | `rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo` |
| XDX | `XDX` / hex `5844580000000000000000000000000000000000` |
| XDX/XRP AMM + LP issuer | `rhEwhutV5EyYzTbBYDdK7dHxwdi5omqffB` |
| XDX/XRP LP hex | `03970105D80AE3C54085F6E97EE16CEDE6CE8200` |
| RLUSD issuer | `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De` |
| RLUSD hex | `524C555344000000000000000000000000000000` |
| XDX/RLUSD AMM | `rLbBzF9oxntVf4XxcyakNKJTci4yqSmQUu` |
| XDX/RLUSD LP hex | `03BCD44104644B711C58CD14CD13CBA65757CFBE` |
