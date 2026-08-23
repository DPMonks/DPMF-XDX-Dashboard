const DEMO_ISSUER = "rFuzionXioDemoIssuer1111111111111";
const DEMO_OWNER = "rFuzionXioDemoOwner11111111111111";

const images = [
  "https://ipfs.io/ipfs/QmZTPCpAPFzVd66CBfhmZoGV3cM9BvEPiHkABE2D1ET6qs",
  "https://picsum.photos/seed/fuzion-xio-2/800/800",
  "https://picsum.photos/seed/fuzion-xio-3/800/800",
  "https://picsum.photos/seed/fuzion-xio-4/800/800"
];

export function demoSeed() {
  const now = new Date().toISOString();
  const nfts = [
    {
      _id: "seed-lilly-1",
      name: "Lilly #1",
      category: "3D Art",
      description: "Demo listing for the recovered FUZION-XIO exchange.",
      image: images[0],
      metaDataUrl: "https://ipfs.io/ipfs/QmenUpvJVoHRS8LAWxY5TujhSTATqu9GjXaA5He41ZzGuk",
      currency: "XRP",
      amount: "12",
      issuer: DEMO_ISSUER,
      Issuer: DEMO_ISSUER,
      accountNumber: DEMO_OWNER,
      NFTokenID: "00080000FUZIONXIODEMO0000000000000000000000000000000001",
      fileType: "image",
      status: "sale",
      likes: 3,
      metaverse: null,
      usdzUrl: null,
      createdAt: now
    },
    {
      _id: "seed-anchor-2",
      name: "Anchor Pulse",
      category: "Digital Art",
      description: "Fresh-start demo NFT. Old Mongo dumps were not loaded.",
      image: images[1],
      currency: "XIO",
      amount: "0.01",
      issuer: DEMO_ISSUER,
      Issuer: DEMO_ISSUER,
      accountNumber: DEMO_OWNER,
      NFTokenID: "00080000FUZIONXIODEMO0000000000000000000000000000000002",
      fileType: "image",
      status: "sale",
      likes: 1,
      createdAt: now
    },
    {
      _id: "seed-orbit-3",
      name: "Orbit Gate",
      category: "Collectibles",
      description: "Browse, open detail, and like against the local API.",
      image: images[2],
      currency: "XDX",
      amount: "25",
      issuer: DEMO_ISSUER,
      Issuer: DEMO_ISSUER,
      accountNumber: DEMO_OWNER,
      NFTokenID: "00080000FUZIONXIODEMO0000000000000000000000000000000003",
      fileType: "image",
      status: "sale",
      likes: 6,
      createdAt: now
    },
    {
      _id: "seed-signal-4",
      name: "Signal Mark",
      category: "Utility",
      description: "Xaman mint/buy routes are stubbed until keys are added.",
      image: images[3],
      currency: "XRP",
      amount: "3.5",
      issuer: DEMO_ISSUER,
      Issuer: DEMO_ISSUER,
      accountNumber: DEMO_OWNER,
      NFTokenID: "00080000FUZIONXIODEMO0000000000000000000000000000000004",
      fileType: "image",
      status: "minted",
      likes: 0,
      createdAt: now
    }
  ];

  return {
    nfts,
    profiles: [
      {
        _id: "seed-profile-demo",
        wAddress: DEMO_OWNER,
        pName: "FUZION Demo",
        pImage: images[0],
        pBanner: "",
        dBanner: "",
        isActive: true,
        vPoint: 120
      },
      {
        _id: "seed-profile-issuer",
        wAddress: DEMO_ISSUER,
        pName: "XIO Issuer",
        pImage: images[1],
        isActive: true,
        vPoint: 10050
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
    collections: []
  };
}
