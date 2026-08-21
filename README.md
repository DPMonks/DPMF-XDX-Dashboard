# DPMF-XDX Dashboard

Frontend for the [DPMF XDX indexer](https://dpmf-xdx-indexer-production.up.railway.app). This app reads live XRPL holder, LP, AMM, chart, and wallet data from the indexer API and uses the indexer’s Xaman routes for wallet sign-in.

## Pairing

| Layer | Source |
| --- | --- |
| Dashboard | this repo (`DPMF-XDX-Dashboard`) |
| Indexer API | `VITE_INDEXER_URL` (defaults to Railway production) |

The dashboard never talks to Xaman or XRPL directly for indexed data. Wallet QR payloads are created by the indexer so API keys stay on the backend.

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Override `VITE_INDEXER_URL` to point at a local or staging indexer.

## Indexer endpoints used

- `/api/overview`, `/api/amm`, `/api/pools`
- `/api/top-holders`, `/api/top-lp`
- `/api/token-details-static`, `/api/token-details-live` (falls back to `/api/token-details`)
- `/api/activity-chart` (falls back to `/api/charts/tvl`, `/api/charts/holders`, `/api/charts/lp-holders`)
- `/api/wallet/balances/:address`, `/api/wallet/networth/:address`
- `/api/xaman/create-payload` and `/api/xaman/payload-result` (with older path fallbacks)

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run lint` — ESLint
