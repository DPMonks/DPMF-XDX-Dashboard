import { INDEXER_ORIGIN, THREE_D_TYPES, XIO_CURRENCY, XIO_ISSUER, XRPL_RPC } from "./constants.js";
import { feePolicy } from "./fees.js";

export function capabilityMap() {
  const fee = feePolicy();
  return {
    product: "FUZION-XIO",
    positioning: `XRPL NFT-Fi exchange — ${fee.label} platform fee, multi-currency, first-class 3D`,
    comparedTo: ["OpenSea", "Blur", "Magic Eden", "Tensor", "SuperRare", "xrp.cafe"],
    advantages: [
      "Any XRPL issued asset as payment, not only the gas token",
      "Native GLB / GLTF / FBX / USDZ + AR viewers",
      "XIO governance ranks and vScore profile badges",
      `${fee.label} trade fee on every asset; royalties stay with the issuer`,
      "Wallet auto-downloads trustlines as assets are used",
      "XLS-20 native NFTs plus Dynamic NFT (XLS-46) path",
      "XDX indexer token data (holders, prices, wallet balances)"
    ],
    overview: [
      {
        id: 1,
        title: "Multi-currency NFT exchange",
        status: "live",
        points: [
          "Mint and trade NFTs in any XRPL issued asset",
          "Multi-currency and multi-asset offers",
          "Instant catalog access to newly issued XRPL assets",
          "Social finance modules on personal profiles"
        ]
      },
      {
        id: 2,
        title: "All-currency NFT minting engine",
        status: "live",
        points: [
          "Images, audio, video, PDF, and 3D (GLB/GLTF/FBX/USDZ/OBJ)",
          "Creator-controlled pricing and mint currency",
          "Prepared file packs ready to create"
        ]
      },
      {
        id: 3,
        title: "Dynamic NFTs (dNFTs) on XRPL",
        status: "partial",
        points: [
          "XLS-46 path for metadata that can evolve",
          "URI update signing lands with Xaman keys"
        ]
      },
      {
        id: 4,
        title: "Game-Fi infrastructure",
        status: "partial",
        points: [
          "Updatable URI path and multi-currency game-item trades",
          "Full conditional metadata / leveling is staged"
        ]
      },
      {
        id: 5,
        title: "Advanced NFT trading",
        status: "live",
        points: [
          "Item and collection offers, auctions, sweep",
          "First-issue trading of new XRPL currencies",
          `${fee.label} desk fee on every traded asset`
        ]
      },
      {
        id: 6,
        title: "Decentralised profile validation",
        status: "live",
        points: [
          "Validate profiles with fractional asset payments",
          "Receiver chooses the asset",
          "V-Score and validator power rise with activity"
        ]
      },
      {
        id: 7,
        title: "XIO-powered validator ranks",
        status: "live",
        points: [
          "New 0.0001 · Beginner 0.001 · Basic 0.01 · Validator 0.1",
          "Active 1 · Trusted 10 · Master 100"
        ]
      },
      {
        id: 8,
        title: "Profile V-Score",
        status: "live",
        points: [
          "100 V-Score: blue checkmark",
          "10,000 V-Score: gold checkmark",
          "Applies to the profile and NFTs linked to it"
        ]
      },
      {
        id: 9,
        title: "Y.E.M.2 — Yield Earning Mechanism",
        status: "reserved",
        points: ["Page is live and blank for later yield build-out"]
      },
      {
        id: 10,
        title: "Social finance + creator tools",
        status: "live",
        points: [
          "Free profiles, validation monetisation, creator pricing",
          "Profile-linked NFT verification"
        ]
      },
      {
        id: 11,
        title: "High-performance architecture",
        status: "live",
        points: [
          "XRPL RPC + XDX indexer",
          `${fee.label} fee, auto trustlines, multi-asset settlement`,
          "Collector address will be added later"
        ]
      },
      {
        id: 12,
        title: "Marketplace V2 — discovery",
        status: "live",
        points: [
          "Global search across NFTs, collections, creators, and assets",
          "Trending, 24h/7d volume, new drops, editor’s picks",
          "Verified badges and unverified/suspicious warnings"
        ]
      },
      {
        id: 13,
        title: "Marketplace V2 — analytics",
        status: "live",
        points: [
          "Floor per currency, floor history, rarity ranks, trait filters",
          "Collection volume, holders, whales, creator royalty periods",
          "Wallet portfolio value, P&L, collection breakdown"
        ]
      },
      {
        id: 14,
        title: "Marketplace V2 — pro trading",
        status: "live",
        points: [
          "Standard / Pro view toggle",
          "Trader desk: live floor, bid depth, listings, batch list, sweep",
          "Aggregator ingest ready for later XRPL marketplace sources"
        ]
      },
      {
        id: 15,
        title: "Marketplace V2 — drops + social + governance",
        status: "live",
        points: [
          "Scheduled drops, launchpad review, allowlist-gated pre-mint",
          "Likes, follows, comments, reports, moderation queue",
          "XIO-weighted proposals and voting history"
        ]
      }
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
        gapVsFuzion: `1.589% marketplace fee vs FUZION ${fee.label}; mint focused on image/video/audio; no XIO governance or 3D/AR first class`
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
      multiAssetOffers: true,
      xrplNftOffers: true,
      xrplAccountTape: true,
      tradeCatalog: true,
      personalProfiles: true,
      profileOpenGraph: true,
      profileNfts: true,
      preparedMintPacks: true,
      platformFee: true,
      autoTrustlines: true,
      yemPage: true,
      discover: true,
      verifiedCollections: true,
      rarityRanks: true,
      floorHistory: true,
      proView: true,
      batchList: true,
      collectionBids: true,
      drops: true,
      allowlists: true,
      commentsFollows: true,
      reports: true,
      governanceVotes: true,
      fiatRampSlot: true,
      onboarding: true,
      zeroPlatformFee: false
    },
    fee,
    next: {
      xamanSigning: false,
      dNftUriUpdate: false,
      feeCollectorAddress: !fee.collector,
      yemRewards: true
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
      thresholds: {
        "New Validator": 0.0001,
        "Beginner Validator": 0.001,
        "Basic Validator": 0.01,
        Validator: 0.1,
        "Active Validator": 1,
        "Trusted Validator": 10,
        "Master Validator": 100
      },
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
