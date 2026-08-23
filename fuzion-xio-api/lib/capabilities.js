import { INDEXER_ORIGIN, THREE_D_TYPES, XIO_CURRENCY, XIO_ISSUER, XRPL_RPC } from "./constants.js";

export function capabilityMap() {
  return {
    product: "FUZION-XIO",
    positioning: "XRPL NFT-Fi exchange — 0% platform fee, multi-currency, first-class 3D",
    comparedTo: ["OpenSea", "Blur", "Magic Eden", "Tensor", "SuperRare", "xrp.cafe"],
    advantages: [
      "Any XRPL issued asset as payment, not only the gas token",
      "Native GLB / GLTF / FBX / USDZ + AR viewers",
      "XIO governance ranks and vScore profile badges",
      "0% trade fee; royalties stay with the issuer",
      "XLS-20 native NFTs plus Dynamic NFT (XLS-46) path",
      "XDX indexer token data (holders, prices, wallet balances)",
      "Virtual collections of 1,000–10,000 without fat document dumps"
    ],
    peers: {
      opensea: {
        strength: "Discovery, trait filters, collection pages",
        gapVsFuzion: "ETH-centric, weak 3D, no XRPL multi-asset pay"
      },
      blur: {
        strength: "Pro trading, collection bids, low fees",
        gapVsFuzion: "No 3D/AR, no governance profiles, EVM only"
      },
      magicEden: {
        strength: "Multi-chain launchpad + marketplace",
        gapVsFuzion: "No XIO ranks, limited XRPL asset picker"
      },
      xrpCafe: {
        strength: "XRPL native mint/buy/sell/auction, bulk tools",
        gapVsFuzion:
          "1.589% marketplace fee vs FUZION 0%; mint focused on image/video/audio; no XIO governance or 3D/AR first class"
      }
    },
    live: {
      browse: true,
      detail: true,
      like: true,
      profiles: true,
      vScore: true,
      xioRanks: true,
      collectionsVirtual: true,
      threeD: true,
      multiCurrency: true,
      indexerTokens: true,
      xrplAccountNfts: true,
      xrplNftInfo: true,
      traitFilters: true,
      floorTape: true,
      activity: true,
      rankings: true,
      itemOffers: true,
      collectionOffers: true,
      auctions: true,
      sweep: true,
      watchlist: true,
      multiCurrency: true,
      multiAssetOffers: true,
      xrplNftOffers: true,
      xrplAccountTape: true,
      tradeCatalog: true,
      zeroPlatformFee: true
    },
    next: {
      xamanSigning: false,
      dNftUriUpdate: false
    },
    threeD: {
      types: THREE_D_TYPES,
      viewers: ["FbxViewer", "@google/model-viewer"],
      ar: "USDZ on iOS when usdzUrl is present"
    },
    governance: {
      asset: XIO_CURRENCY,
      issuer: XIO_ISSUER,
      ranks: [
        "New Validator",
        "Beginner Validator",
        "Basic Validator",
        "Validator",
        "Active Validator",
        "Trusted Validator",
        "Master Validator"
      ],
      badges: { tick: "0-99", blue: "100-9999", gold: ">=10000" }
    },
    sources: {
      indexer: INDEXER_ORIGIN,
      xrpl: XRPL_RPC,
      liveSite: "https://fuzion-xio.com",
      dpmf: "https://www.dpmf.technology/",
      exchangeBrand: "https://xdx-exchange.dpmf.technology"
    }
  };
}
