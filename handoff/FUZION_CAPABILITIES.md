# FUZION-XIO capability map

Compared against OpenSea, Blur, Magic Eden, Tensor, SuperRare, and XRPL peers (xrp.cafe). Foundation is the recovered FUZION frontend + this local API. Old Mongo dumps were index-only and are not loaded.

Live product facts come from [dpmf.technology](https://www.dpmf.technology/) (XD-1 FUZION-XIO), [fuzion-xio.com](https://fuzion-xio.com), and the XDX dark brand on [xdx-exchange.dpmf.technology](https://xdx-exchange.dpmf.technology).

## What the best markets do

| Capability | OpenSea | Blur / Tensor | Magic Eden | SuperRare | xrp.cafe | FUZION now |
| --- | --- | --- | --- | --- | --- | --- |
| Browse / trait filter / collection pages | Yes | Pro tools | Yes | Curated | Featured + drops | Explore desk + trait facets + floor tape |
| Fixed price + offers | Yes | Collection bids | Yes | Primary + secondary | Buy / sell / auction | Sale, bid, more-offers, send (signing next) |
| Royalties | Policy / on-chain | Often optional | Varies | Enforced | L1 transfer fee | 100% to issuer |
| Fees | 0.5–2.5% | 0%–2% | ~2% | High gallery | **1.589%** + launch fees | **0% trade fee** |
| Multi-currency pay | Rare (ETH/SOL) | Native gas | Native | ETH | XRP + tokens | **Any XRPL asset** + indexer picker |
| 3D / GLB / FBX / USDZ / AR | Limited | Rare | Limited | Art-first | Image / video / audio | **Native 3D + AR path** |
| Batch collections (1k+) | Yes | Yes | Yes | No | Bulk mint scripts | Template + virtual pages to 10k |
| Activity tape | Yes | Yes | Yes | Yes | Recent | `/activity` + `/api/market/activity` |
| Collection offers / sweep | Rare | Yes | Partial | No | Rare | Collection offer + cheapest-N sweep, 0% fee |
| Auctions | Rare | Rare | Partial | Yes | Yes | Reserve + live bids on the desk |
| Profiles / social | Thin | Thin | Medium | Artist bios | Wallet | **Profiles + validation + checkmarks** |
| Governance | Token optional | BLUR / TNSR | ME | No | No | **XIO ranks + vScore** |
| Ledger-native NFTs | EVM/SOL | EVM/SOL | Multi | EVM | **XLS-20** | **XLS-20** + `nft_info` / `account_nfts` |
| Dynamic NFT | Rare | Rare | Rare | No | XLS-46 on ledger | dNFT-ready (URI update next) |
| RWA / phygital | Emerging | No | No | No | Rare | Not a FUZION page (XD-6 is separate) |

## Why FUZION can be the best XRPL NFT-Fi venue

xrp.cafe is the strongest XRPL peer: non-custodial XLS-20, auctions, bulk mint, Arweave. FUZION differentiates on **0% fee**, **any issued asset as payment**, **3D/AR as a first-class mint type**, and **XIO governance + validated profiles**. AVA, MegaBits, and RWA sculpture are **separate XD projects** — they may list on this exchange later, but they are not built as FUZION pages. OpenSea/Blur/Magic Eden win on liquidity and pro tools; they do not sit on XRPL multi-asset rails or XIO ranks.

## FUZION / DPMF product facts

- Multi-currency NFT-Fi on XRPL (fixed price + P2P, thousands of issued assets)
- Free profiles, decentralised validation, blue/gold checkmarks
- XIO (`rfuzioNFTKArnU1PQD5BEF272vpbHMRoxU`) is the governance asset
- XIO ranks: New → Beginner → Basic → Validator → Active → Trusted → Master
- Mint: images, video, audio, PDF, **GLB / FBX / USDZ**, 3D + AR
- 0% trading fee, issuer royalties
- Xaman signing (QR / push) — local API stubs until keys are added
- XDX indexer for token holders, prices, AMM, wallet balances
- AVA (XD-3), MegaBits, and RWA sculpture (XD-6) stay on their own projects — not FUZION routes or seeded collections

## Validator ranks (XIO balance)

| Rank | XIO |
| --- | --- |
| New Validator | 0 &lt; x ≤ 0.001 |
| Beginner Validator | 0.001–0.01 |
| Basic Validator | 0.01–0.1 |
| Validator | 0.1–1 |
| Active Validator | 1–10 |
| Trusted Validator | 10–100 |
| Master Validator | ≥ 100 |

vScore badges on NFTs: tick (0–99), blue (100–9999), gold (≥ 10000).

## Paramount: 3D file NFTs

Accepted mint types already in the recovered app: `glb`, `gltf`, `fbx`, `usdz`, plus image/gif/video/audio/pdf. Viewers: `FbxViewer` + `@google/model-viewer`, USDZ on iOS. Seeded virtual collection is a generic marketplace drop only:

| Collection | Size | Program | File |
| --- | --- | --- | --- |
| FUZION 3D | 1,000 | XD-1 | GLB |

Items are **template + virtual index**. Paged APIs materialise 12 rows at a time so we do not write thousands of fat documents.

## Indexer + XRPL

- Indexer: `https://dpmf-xdx-indexer-production.up.railway.app` (`/`, `/health`, `/api/overview`, `/api/prices`, `/api/wallet/balances/:address`, `/api/pools`)
- XRPL: `https://xrplcluster.com` (`account_nfts`, `nft_info`, `account_lines`)

Local routes: `/api/tokens`, `/api/indexer/*`, `/api/xrpl/*`, `/api/governance/:address`.

When the indexer 429s, the API serves cached / static XDX·XIO·XSQUAD constants from this repo.

## Brand

Frontend dark mode matches the XDX dashboard / indexer: `#050507` field, violet `#c770ff`, cyan `#00eaff`, lime `#98f050`, text `#e8e8f5`.
