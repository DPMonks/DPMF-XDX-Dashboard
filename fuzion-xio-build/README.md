# FUZION-XIO production build archive

Downloaded from the live nginx host `https://fuzion-xio.com` on 23 August 2026.

This is **not** the DPMF-XDX dashboard. It is the Create React App production deploy currently served for the FUZION-XIO NFT exchange (`Last-Modified: Tue, 05 May 2026`).

`DPMonks/RaDical-X` is the earlier public repo the owner pointed at. It is empty (created 7 November 2023, no commits), so this archive is the current source of truth for the live site.

## Layout

| Path | What it is |
| --- | --- |
| `index.html`, `static/`, `asset-manifest.json` | Production CRA build as served |
| `static/js/*.map`, `static/css/*.map` | Source maps shipped with that build |
| `recovered-src/` | First-party JS/CSS extracted from those maps (90 files) |
| `recovered-src/config.json` | Production API / IPFS URLs reconstructed from the minified bundle |

Public extras also saved: `favicon.ico`, `asset/favicon.ico`, `ioslogo.png`, `logo192.png`, `logo512.png`, `manifest.json`, `robots.txt`.

## Recovered app

Webpack chunk name is `frontend`. Routes include `/`, `/Createnft`, `/MyNFT`, `/Profile`, `/collections`, `/Vscoredashboard`, `/Xiodashboard`, bid/offer/search/detail pages.

The browser talks to `https://fuzion-xio.com/api/` (Xaman connect, mint, profile, NFT list). IPFS reads go through `https://radical-x.infura-ipfs.io/ipfs/`.

`recovered-src/` is **not** a runnable CRA tree on its own: `package.json`, `public/`, env files, and some imported assets (`assets/tabsimages/*`, `BGIMAGE_URL`) were not in the maps.

Infura project id/secret are read from `REACT_APP_INFURA_IPFS_*` at build time and are not stored here.

## Preview the static build

The files under this folder are the compiled frontend only. `npm start` in the dashboard repo will not serve them. Use any static file server rooted at this directory, for example:

```bash
npx --yes serve fuzion-xio-build
```

API calls still go to the live `https://fuzion-xio.com/api/` host.
