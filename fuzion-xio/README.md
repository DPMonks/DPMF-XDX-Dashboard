# FUZION-XIO exchange (runnable)

Recovered Create React App frontend from the live [fuzion-xio.com](https://fuzion-xio.com) production build (5 May 2026), wired as a Vite app that talks to the existing XRPL NFT exchange API.

## What works in this step

- Local Vite app with the recovered marketplace, profile, mint, offer, and wallet UI
- Live catalog via `GET https://fuzion-xio.com/api/nft/home` (CORS is open)
- Xaman connect / mint / buy / sell / validate still call the production `/api` host
- Production images remapped into `src/assets`; toast copy restored in `src/const/message.json`

Infura project keys are **not** required to browse the exchange. They are required only to upload new files to IPFS when minting.

## Run

Start the local API first (fresh demo catalog, old Mongo dumps are not used):

```bash
cd fuzion-xio-api
npm install
npm start
```

Then the frontend:

```bash
cd fuzion-xio
npm install
npm run dev
```

Open http://localhost:5174

The Vite dev server proxies `/api` to `http://127.0.0.1:8080`.

```bash
npm run build
npm run preview
```

## Config

`src/config.json` uses same-origin `/api/` (Vite → local Express). IPFS reads still go through the public gateway:

| Key | Value |
| --- | --- |
| `LOCAL_API_URL` | `/api/` |
| `ipfs_p` | `https://radical-x.infura-ipfs.io/ipfs/` |

Copy `.env.example` to `.env` if you need Infura mint uploads.

`DPMonks/RaDical-X` is the earlier public repo name; that repository is empty. This app is the recovered live frontend.
