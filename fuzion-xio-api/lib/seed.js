import { DEMO_GLB, XDX_CURRENCY, XDX_ISSUER, XIO_CURRENCY, XIO_ISSUER } from "./constants.js";
import { PLATFORM_FEE_BPS } from "./fees.js";

export const STORE_VERSION = 10;

export const DEMO_ISSUER = "rFuzionXioDemoIssuer1111111111111";
export const DEMO_OWNER = "rFuzionXioDemoOwner11111111111111";
export const DEMO_BIDDER = "rFuzionXioDemoBidder1111111111111";

const images = [
  "https://ipfs.io/ipfs/QmZTPCpAPFzVd66CBfhmZoGV3cM9BvEPiHkABE2D1ET6qs",
  "https://picsum.photos/seed/fuzion-xio-2/800/800",
  "https://picsum.photos/seed/fuzion-xio-3/800/800",
  "https://picsum.photos/seed/fuzion-xio-4/800/800",
  "https://picsum.photos/seed/fuzion-3d/800/800"
];

function nft(partial) {
  const fileType = partial.fileType || "image";
  return {
    issuer: DEMO_ISSUER,
    Issuer: DEMO_ISSUER,
    IssuerAddr: DEMO_ISSUER,
    accountNumber: DEMO_OWNER,
    likes: 0,
    metaverse: null,
    usdzUrl: null,
    isPurchased: 1,
    isMinted: true,
    createdAt: new Date().toISOString(),
    ...partial,
    fileType,
    contentType: partial.contentType || fileType
  };
}

export function demoSeed() {
  const now = new Date().toISOString();
  const collectionTemplates = [
    {
      slug: "fuzion-3d",
      collectionName: "FUZION 3D",
      size: 1000,
      fileType: "glb",
      contentType: "glb",
      category: "3D Art",
      currency: XIO_CURRENCY,
      amount: "1",
      program: "XD-1",
      description:
        "Marketplace 3D drop on FUZION-XIO. GLB / AR-ready files at collection scale.",
      image: images[4],
      metaverse: DEMO_GLB,
      usdzUrl: null,
      issuer: DEMO_ISSUER,
      owner: DEMO_OWNER,
      verified: true,
      banner: images[4],
      royaltyBps: 500,
      royaltyRecipient: DEMO_ISSUER,
      createdAt: now
    }
  ];

  const nfts = [
    nft({
      _id: "seed-lilly-1",
      name: "Lilly #1",
      category: "3D Art",
      description: "Demo listing for the recovered FUZION-XIO exchange.",
      image: images[0],
      metaDataUrl: "https://ipfs.io/ipfs/QmenUpvJVoHRS8LAWxY5TujhSTATqu9GjXaA5He41ZzGuk",
      currency: "XRP",
      amount: "12",
      NFTokenID: "00080000FUZIONXIODEMO0000000000000000000000000000000001",
      fileType: "image",
      status: "sale",
      likes: 3,
      royaltyBps: 500,
      royaltyRecipient: DEMO_ISSUER,
      fileHash: "demo-lilly-hash",
      platformFeeBps: PLATFORM_FEE_BPS
    }),
    nft({
      _id: "seed-anchor-2",
      name: "Anchor Pulse",
      category: "Digital Art",
      description: "Fresh-start demo NFT. Old Mongo dumps were not loaded.",
      image: images[1],
      currency: XIO_CURRENCY,
      amount: "0.01",
      NFTokenID: "00080000FUZIONXIODEMO0000000000000000000000000000000002",
      fileType: "image",
      status: "sale",
      likes: 1
    }),
    nft({
      _id: "seed-orbit-3",
      name: "Orbit Gate",
      category: "Collectibles",
      description: "Browse, open detail, and like against the local API.",
      image: images[2],
      currency: XDX_CURRENCY,
      amount: "25",
      NFTokenID: "00080000FUZIONXIODEMO0000000000000000000000000000000003",
      fileType: "image",
      status: "sale",
      likes: 6
    }),
    nft({
      _id: "seed-signal-4",
      name: "Signal Mark",
      category: "Utility",
      description: "Xaman connect and ledger signing use XUMM_API_KEY and XUMM_API_SECRET.",
      image: images[3],
      currency: "XRP",
      amount: "3.5",
      NFTokenID: "00080000FUZIONXIODEMO0000000000000000000000000000000004",
      fileType: "image",
      status: "minted",
      likes: 0,
      isPurchased: 1
    }),
    nft({
      _id: "seed-clip-video",
      name: "Signal Reel",
      category: "Video",
      description: "MP4 listing — video files mint and play on the exchange.",
      image: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      currency: "XRP",
      amount: "2",
      NFTokenID: "00080000FUZIONXIODEMO0000000000000000000000000000000005",
      fileType: "video",
      contentType: "video",
      status: "sale",
      likes: 4
    }),
    nft({
      _id: "seed-clip-audio",
      name: "Anchor Tone",
      category: "Audio",
      description: "MPEG audio listing — mp3/wav/ogg/m4a mint and play.",
      image: "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3",
      currency: XIO_CURRENCY,
      amount: "0.02",
      NFTokenID: "00080000FUZIONXIODEMO0000000000000000000000000000000006",
      fileType: "audio",
      contentType: "audio",
      status: "sale",
      likes: 2
    }),
    nft({
      _id: "seed-clip-pdf",
      name: "Desk Brief",
      category: "Utility",
      description: "PDF listing — documents mint and render in the viewer.",
      image: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      currency: "XRP",
      amount: "1",
      NFTokenID: "00080000FUZIONXIODEMO0000000000000000000000000000000007",
      fileType: "application",
      contentType: "application",
      status: "sale",
      likes: 1
    }),
    nft({
      _id: "seed-clip-webp",
      name: "Web Frame",
      category: "Digital Art",
      description: "WEBP still — modern image types mint alongside png/jpg/gif/svg.",
      image: "https://www.gstatic.com/webp/gallery/1.webp",
      currency: XDX_CURRENCY,
      amount: "8",
      NFTokenID: "00080000FUZIONXIODEMO0000000000000000000000000000000008",
      fileType: "image",
      contentType: "image",
      status: "sale",
      likes: 5
    }),
    nft({
      _id: "seed-fuzion-3d-hero",
      name: "FUZION 3D #1",
      collectionName: "FUZION 3D",
      category: "3D Art",
      description: "Hero 3D listing for a generic FUZION marketplace collection.",
      image: DEMO_GLB,
      previewImage: images[4],
      metaverse: DEMO_GLB,
      currency: XIO_CURRENCY,
      amount: "1",
      NFTokenID: "00080000FUZION3D00000000000000000000000000000000000001",
      fileType: "glb",
      contentType: "glb",
      status: "sale",
      likes: 18,
      program: "XD-1"
    })
  ];

  return {
    version: STORE_VERSION,
    nfts,
    collectionTemplates,
    collections: [],
    profiles: [
      {
        _id: "seed-profile-demo",
        wAddress: DEMO_OWNER,
        pName: "FUZION Demo",
        pImage: images[0],
        pBanner: images[4],
        dBanner: images[3],
        isActive: true,
        vPoint: 120,
        tagline: "XRPL collector on XD-1",
        location: "Ledger",
        website: "https://fuzion-xio.com",
        bio: "Collector profile. Validation and XIO rank drive the checkmark.",
        createdAt: now,
        profileNfts: [
          {
            _id: "pin-demo-lilly",
            nftId: "seed-lilly-1",
            NFTokenID: "00080000FUZIONXIODEMO0000000000000000000000000000000001",
            name: "Lilly #1",
            addedAt: now
          },
          {
            _id: "pin-demo-3d",
            nftId: "seed-fuzion-3d-hero",
            NFTokenID: "00080000FUZION3D00000000000000000000000000000000000001",
            name: "FUZION 3D #1",
            addedAt: now
          }
        ],
        profileHiddenNfts: []
      },
      {
        _id: "seed-profile-issuer",
        wAddress: DEMO_ISSUER,
        pName: "XIO Issuer",
        pImage: images[1],
        pBanner: images[0],
        dBanner: images[4],
        isActive: true,
        vPoint: 10050,
        tagline: "Governance issuer",
        location: "FUZION-XIO",
        website: "https://www.dpmf.technology/FUZION-XIO",
        bio: "Governance issuer profile. Master Validator when XIO ≥ 100.",
        createdAt: now,
        profileNfts: [],
        profileHiddenNfts: []
      },
      {
        _id: "seed-profile-bidder",
        wAddress: DEMO_BIDDER,
        pName: "Desk Bidder",
        pImage: images[2],
        pBanner: images[3],
        dBanner: images[1],
        isActive: true,
        vPoint: 240,
        tagline: "Multi-asset offers",
        location: "Market desk",
        website: "https://fuzion-xio.com/assets",
        bio: "Makes collection offers and auction bids on the local desk.",
        createdAt: now,
        profileNfts: [],
        profileHiddenNfts: []
      }
    ],
    likes: [],
    offers: [
      {
        _id: "off-lilly",
        kind: "item",
        nftId: "seed-lilly-1",
        name: "Lilly #1",
        amount: "10",
        currency: "XRP",
        issuer: "",
        assets: [{ currency: "XRP", issuer: "", amount: "10" }],
        label: "10 XRP",
        from: DEMO_BIDDER,
        status: "open",
        source: "desk",
        createdAt: now
      },
      {
        _id: "off-col-3d",
        kind: "collection",
        nftId: null,
        name: "FUZION 3D",
        collectionName: "FUZION 3D",
        collectionSlug: "fuzion-3d",
        amount: "0.8",
        currency: XIO_CURRENCY,
        issuer: XIO_ISSUER,
        assets: [
          { currency: XIO_CURRENCY, issuer: XIO_ISSUER, amount: "0.8" }
        ],
        label: "0.8 XIO",
        from: DEMO_BIDDER,
        status: "open",
        source: "desk",
        createdAt: now
      },
      {
        _id: "off-multi-lilly",
        kind: "item",
        nftId: "seed-lilly-1",
        name: "Lilly #1",
        amount: "5",
        currency: "XRP",
        issuer: "",
        assets: [
          { currency: "XRP", issuer: "", amount: "5" },
          { currency: XIO_CURRENCY, issuer: XIO_ISSUER, amount: "1" },
          { currency: XDX_CURRENCY, issuer: XDX_ISSUER, amount: "20" }
        ],
        label: "5 XRP + 1 XIO + 20 XDX",
        from: DEMO_BIDDER,
        status: "open",
        source: "desk",
        createdAt: now
      }
    ],
    mints: [],
    bids: [
      {
        _id: "bid-signal-1",
        auctionId: "auc-signal",
        nftId: "seed-signal-4",
        from: DEMO_BIDDER,
        amount: "4.2",
        createdAt: now
      }
    ],
    moreoffers: [],
    sends: [],
    tradehistories: [
      {
        nftID: "seed-orbit-3",
        NFTokenID: "00080000FUZIONXIODEMO0000000000000000000000000000000003",
        amount: "22",
        currency: XDX_CURRENCY,
        from: DEMO_ISSUER,
        to: DEMO_OWNER,
        createdAt: now,
        type: "sale"
      }
    ],
    auctions: [
      {
        _id: "auc-signal",
        nftId: "seed-signal-4",
        name: "Signal Mark",
        collectionName: null,
        minBid: "3.5",
        reserve: "5",
        currency: "XRP",
        seller: DEMO_OWNER,
        endsAt: new Date(Date.now() + 36 * 3600 * 1000).toISOString(),
        bids: [
          { _id: "bid-signal-1", from: DEMO_BIDDER, amount: "4.2", createdAt: now }
        ],
        status: "live",
        createdAt: now
      }
    ],
    activity: [
      {
        _id: "act-sale-orbit",
        type: "sale",
        nftId: "seed-orbit-3",
        name: "Orbit Gate",
        amount: "22",
        currency: XDX_CURRENCY,
        from: DEMO_ISSUER,
        to: DEMO_OWNER,
        createdAt: now,
        royaltyBps: 500,
        platformFeeBps: PLATFORM_FEE_BPS
      },
      {
        _id: "act-list-lilly",
        type: "list",
        nftId: "seed-lilly-1",
        name: "Lilly #1",
        amount: "12",
        currency: "XRP",
        from: DEMO_OWNER,
        createdAt: now
      },
      {
        _id: "act-offer-3d",
        type: "collection_offer",
        name: "FUZION 3D",
        collectionName: "FUZION 3D",
        collectionSlug: "fuzion-3d",
        amount: "0.8",
        currency: XIO_CURRENCY,
        issuer: XIO_ISSUER,
        assets: [{ currency: XIO_CURRENCY, issuer: XIO_ISSUER, amount: "0.8" }],
        label: "0.8 XIO",
        from: DEMO_BIDDER,
        source: "desk",
        createdAt: now
      },
      {
        _id: "act-offer-multi",
        type: "offer",
        nftId: "seed-lilly-1",
        name: "Lilly #1",
        amount: "5",
        currency: "XRP",
        assets: [
          { currency: "XRP", issuer: "", amount: "5" },
          { currency: XIO_CURRENCY, issuer: XIO_ISSUER, amount: "1" },
          { currency: XDX_CURRENCY, issuer: XDX_ISSUER, amount: "20" }
        ],
        label: "5 XRP + 1 XIO + 20 XDX",
        from: DEMO_BIDDER,
        source: "desk",
        createdAt: now
      },
      {
        _id: "act-auction",
        type: "auction",
        nftId: "seed-signal-4",
        name: "Signal Mark",
        amount: "3.5",
        currency: "XRP",
        from: DEMO_OWNER,
        createdAt: now
      },
      {
        _id: "act-bid",
        type: "bid",
        nftId: "seed-signal-4",
        name: "Signal Mark",
        amount: "4.2",
        currency: "XRP",
        from: DEMO_BIDDER,
        createdAt: now
      },
      {
        _id: "act-mint-3d",
        type: "mint",
        nftId: "seed-fuzion-3d-hero",
        name: "FUZION 3D #1",
        collectionName: "FUZION 3D",
        collectionSlug: "fuzion-3d",
        from: DEMO_ISSUER,
        createdAt: now
      },
      {
        _id: "act-validation-owner",
        type: "validation",
        name: "FUZION Demo",
        from: DEMO_BIDDER,
        to: DEMO_OWNER,
        createdAt: now
      },
      {
        _id: "act-drop-horizon",
        type: "drop",
        name: "FUZION 3D Horizon",
        collectionName: "FUZION 3D",
        collectionSlug: "fuzion-3d",
        amount: "1",
        currency: XIO_CURRENCY,
        from: DEMO_ISSUER,
        createdAt: now
      }
    ],
    watchlist: [],
    listingOverrides: {},
    knownAssets: [],
    preparedPacks: [],
    wallets: [],
    fees: [],
    xumms: [],
    leaderboards: [
      { wAddress: DEMO_ISSUER, totalVPoint: 10050, pName: "XIO Issuer" },
      { wAddress: DEMO_OWNER, totalVPoint: 120, pName: "FUZION Demo" },
      { wAddress: DEMO_BIDDER, totalVPoint: 240, pName: "Desk Bidder" }
    ],
    xioHolders: [
      {
        accountNumber: DEMO_ISSUER,
        balance: { value: "128.5", currency: XIO_CURRENCY }
      },
      {
        accountNumber: DEMO_OWNER,
        balance: { value: "12.4", currency: XIO_CURRENCY }
      }
    ],
    verifications: [
      {
        slug: "fuzion-3d",
        name: "FUZION 3D",
        status: "verified",
        method: "manual+issuer"
      }
    ],
    editorPicks: ["seed-lilly-1", "seed-fuzion-3d-hero"],
    drops: [
      {
        _id: "drop-fuzion-3d",
        slug: "fuzion-3d-horizon",
        name: "FUZION 3D Horizon",
        collectionName: "FUZION 3D",
        description: "Scheduled 3D drop on the local desk.",
        startsAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
        preMintStartsAt: now,
        publicStartsAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        price: "1",
        currency: XIO_CURRENCY,
        allowlist: [DEMO_OWNER, DEMO_ISSUER],
        status: "scheduled"
      }
    ],
    launches: [],
    follows: [],
    comments: [
      {
        _id: "cmt-lilly",
        nftId: "seed-lilly-1",
        from: DEMO_BIDDER,
        text: "Clean listing. Multi-asset offer incoming.",
        createdAt: now
      }
    ],
    reports: [],
    proposals: [
      {
        _id: "gov-fee-split",
        title: "Keep 0.1% desk fee, publish collector later",
        kind: "fee",
        body: "XIO-weighted vote on fee transparency while the collector address is pending.",
        status: "open",
        yes: 128.5,
        no: 0,
        createdAt: now
      },
      {
        _id: "gov-3d-curation",
        title: "Feature 3D collections in Editor’s picks",
        kind: "curation",
        body: "Keep generic marketplace 3D first-class. AVA / MegaBits / RWA stay separate.",
        status: "closed",
        yes: 140,
        no: 2,
        createdAt: now
      }
    ],
    votes: [
      {
        key: "gov-fee-split:" + DEMO_ISSUER,
        proposalId: "gov-fee-split",
        address: DEMO_ISSUER,
        support: true,
        weight: 128.5
      }
    ],
    fileHashes: [
      { nftId: "seed-lilly-1", hash: "demo-lilly-hash" }
    ],
    aggregator: {
      sources: [
        { id: "desk", name: "FUZION desk", chain: "xrpl" },
        { id: "xrpl-offers", name: "XRPL nft_buy_offers / nft_sell_offers", chain: "xrpl" }
      ],
      listings: []
    }
  };
}
