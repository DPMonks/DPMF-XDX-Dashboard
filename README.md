# DPMF-XDX Dashboard

Frontend for the [DPMF XDX indexer](https://dpmf-xdx-indexer-production.up.railway.app). This app reads live XRPL holder, LP, AMM, chart, and wallet data from the indexer SQL tables and uses the indexer’s Xaman routes for wallet sign-in.

## Pairing

| Layer | Source |
| --- | --- |
| Dashboard | this repo (`DPMF-XDX-Dashboard`) |
| Indexer API | same-origin `/api` proxy to Railway production |

The browser calls `/api/*` on the dashboard host. Vite (local) and Vercel (preview/prod) forward those requests to `https://dpmf-xdx-indexer-production.up.railway.app`. Xaman QR payloads stay on the indexer so API keys never sit in the frontend.

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Override `VITE_INDEXER_URL` to point at a local or staging indexer.

## Indexer tables and endpoints

| SQL surface | Endpoint | Dashboard card |
| --- | --- | --- |
| `token_holders_latest` | `/api/top-holders` (and `/api/top-holders-v2`) | Top XDX Holders rich list |
| `lp_holders_latest` | `/api/top-lp` | LP Holders with pair (`XDX/XRP`, `XDX/RLUSD`, …) |
| `amm_pool_latest` | `/api/amm`, `/api/pools` | AMM Pools |
| overview counts / TVL | `/api/overview` | Network Snapshot |
| token metrics | `/api/token-details-static`, `/api/token-details-live` | Token Details |
| `amm_pool_history`, `holders_history`, `lp_holders_history_daily` | `/api/activity-chart`, `/api/charts/*` | Activity Chart + history |
| `xrp_balances_latest`, holder/LP rows | `/api/wallet/balances/:address`, `/api/wallet/networth/:address` | Connected Wallet |
| Xaman | `/api/xaman/create-payload`, `/api/xaman/payload-result` | Single Connect Wallet button |

Language is detected from the visitor’s IP nation (ipwho.is / ipapi.co) and rendered in that country’s natural language, with number formatting in the matching locale.

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run lint` — ESLint
