# DPMF-XDX Dashboard

Frontend for the DPMF XDX indexer. The browser never talks to the XRPL. Indexed holder, LP, AMM, chart, and wallet data come from `VITE_API_BASE`. Xaman sign-in stays on this repo (`/api/xaman/*`).

## Pairing

| Layer | Source |
| --- | --- |
| Dashboard | this repo |
| Indexer | `VITE_API_BASE` (default Railway production) |
| Xaman | dashboard `/api/xaman/create-payload` using `XUMM_API_KEY` / `XUMM_API_SECRET` |

On-ledger constants (do not treat `rDgGyBao…` as the pool):

| Item | Value |
| --- | --- |
| XDX issuer | `rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo` |
| XDX/XRP AMM + LP issuer | `rhEwhutV5EyYzTbBYDdK7dHxwdi5omqffB` |
| XDX/RLUSD AMM | `rLbBzF9oxntVf4XxcyakNKJTci4yqSmQUu` |

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

`.env` and `.env.local` are gitignored. Put real Xaman values only in the local file.

The Railway host can return HTTP 429. The client checks `res.ok`, retries once, and loads cards sequentially.

## Encrypted secrets (GitHub + Vercel)

Do not commit `.env` files. Production and preview read encrypted store values, not the repo.

| Name | Where | Purpose |
| --- | --- | --- |
| `XUMM_API_KEY` | GitHub Actions secrets **and** Vercel env (Production + Preview) | Xaman API key for `/api/xaman/*` |
| `XUMM_API_SECRET` | GitHub Actions secrets **and** Vercel env (Production + Preview) | Xaman API secret (server-only, no `VITE_` prefix) |
| `VITE_API_BASE` | Vercel env (Production + Preview) | `https://dpmf-xdx-indexer-production.up.railway.app` |

GitHub: repository **Settings → Secrets and variables → Actions**.

Vercel: project **Settings → Environment Variables**, then redeploy.

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run lint` — ESLint
