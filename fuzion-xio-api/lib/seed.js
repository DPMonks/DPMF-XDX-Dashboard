import { DEMO_GLB, XDX_CURRENCY, XIO_CURRENCY } from "./constants.js";

export const STORE_VERSION = 3;

export const DEMO_ISSUER = "rFuzionXioDemoIssuer1111111111111";
export const DEMO_OWNER = "rFuzionXioDemoOwner11111111111111";

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
      likes: 3
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
      description: "Xaman mint/buy routes are stubbed until keys are added.",
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
        pBanner: "",
        dBanner: "",
        isActive: true,
        vPoint: 120,
        bio: "Collector profile. Validation and XIO rank drive the checkmark."
      },
      {
        _id: "seed-profile-issuer",
        wAddress: DEMO_ISSUER,
        pName: "XIO Issuer",
        pImage: images[1],
        isActive: true,
        vPoint: 10050,
        bio: "Governance issuer profile. Master Validator when XIO ≥ 100."
      }
    ],
    likes: [],
    offers: [],
    mints: [],
    bids: [],
    moreoffers: [],
    sends: [],
    tradehistories: [],
    xumms: [],
    leaderboards: [
      { wAddress: DEMO_ISSUER, totalVPoint: 10050, pName: "XIO Issuer" },
      { wAddress: DEMO_OWNER, totalVPoint: 120, pName: "FUZION Demo" }
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
    ]
  };
}
