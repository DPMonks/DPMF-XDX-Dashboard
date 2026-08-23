# FUZION-XIO local API

Express API for the recovered Radical-X / FUZION-XIO frontend.

Mongo dumps that were uploaded were **index metadata only** and are not imported. The JSON store seeds demo listings plus **virtual 3D collections** (template + index, not 10k fat documents).

## Run

```bash
cd fuzion-xio-api
npm install
npm start
```

Health: `GET http://127.0.0.1:8080/api/health`  
Capabilities: `GET http://127.0.0.1:8080/api/capabilities`  
Home catalog: `GET http://127.0.0.1:8080/api/nft/home`

Reset:

```bash
npm run reset
```

## Working now

- Home catalog, list, detail, like
- Profiles, vScore board, XIO validator board and ranks
- Virtual marketplace collections (generic FUZION 3D × 1,000). AVA, MegaBits, and RWA sculpture are separate projects and are not seeded here.
- Market desk: floor/traits, item + collection offers, auctions, sweep, activity, rankings (`/api/market/*`)
- Mint any Create NFT type: images (png/jpg/gif/webp/svg/bmp/avif), video, audio, PDF, GLB/GLTF/FBX/USDZ/OBJ. Local `/api/mint/upload` when Infura is unset.
- Pre-prepared mint packs: `POST /api/mint/prepared` accepts a `.zip` or a set of NFT files, disseminates each file, and leaves them ready to create (`POST /api/mint/prepared/:id/create`).
- 0.1% platform fee on every traded asset (`GET /api/fees`). Collector address is `FEE_COLLECTOR` and will be added later.
- Wallet auto-downloads trustlines as issued assets are used (`POST /api/wallet/trustlines`).
- Y.E.M.2 page is reserved and blank (`/yem`).
- XDX indexer token catalog / prices / wallet balances (cached; static fallback on 429)
- XRPL `account_nfts`, `nft_info`, `account_lines`
- Image proxy `GET /api/assets?url=`
- Frontend same-origin `/api` via the Vite proxy

## Xaman / Xumm

Connect, balances, free profile registration, and mint/buy/sell/burn/send QR flows use the Xumm Platform API.

Set these in `fuzion-xio-api/.env` (never commit them):

```
XUMM_API_KEY=
XUMM_API_SECRET=
```

Get the pair from [apps.xumm.dev](https://apps.xumm.dev). Add these origins on the app:

- `http://127.0.0.1:5174`
- `http://localhost:5174`
- `https://fuzion-xio.com`

`GET /api/health` includes `{ xaman: { configured: true|false } }`.  
`GET /api/xumm/status` is the same flag.

The header already calls `POST /api/xumm/connect` (QR) then `POST /api/xumm/accountDetail` (waits for the signed SignIn and returns a JWT with `ac`). Mint/buy/sell still open a Xaman payload; after the wallet signs, the desk records the fill.

Every Fuzion trade is stamped `marker: FUZION-XIO` with `signed: true|false`. Xaman-signed ledger txs carry the same marker in `Memos`, so they cannot be mixed with paper fills or other XRPL marketplace traffic. Filter the tape with `GET /api/market/activity?signed=true`.
