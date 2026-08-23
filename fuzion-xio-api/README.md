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
- XDX indexer token catalog / prices / wallet balances (cached; static fallback on 429)
- XRPL `account_nfts`, `nft_info`, `account_lines`
- Image proxy `GET /api/assets?url=`
- Frontend same-origin `/api` via the Vite proxy

## Signing (not wired)

Xaman connect / mint / buy / sell still return `{ implemented: false }` until `xumm-sdk` keys are added.
