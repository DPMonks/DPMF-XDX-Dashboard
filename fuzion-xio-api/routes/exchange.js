import { Router } from "express";
import { readStore, update } from "../lib/store.js";

const router = Router();

function notReady(feature) {
  return {
    success: false,
    implemented: false,
    message: `${feature} is not wired yet. The local exchange is a fresh foundation; Xaman/ledger signing comes next.`
  };
}

function nftById(store, id) {
  return store.nfts.find(
    (nft) => nft._id === id || nft.NFTokenID === id || nft.name === id
  );
}

router.get("/health", (_req, res) => {
  const store = readStore();
  res.json({
    ok: true,
    service: "fuzion-xio-api",
    nfts: store.nfts.length,
    profiles: store.profiles.length
  });
});

router.get("/nft/home", (_req, res) => {
  const store = readStore();
  const listed = store.nfts.filter((nft) => nft.status === "sale");
  const minted = store.nfts;
  const liked = [...store.nfts].sort((a, b) => (b.likes || 0) - (a.likes || 0));
  res.json({
    success: true,
    message: "All NFT",
    rcTop: listed.slice(0, 8),
    sallingCreater: store.profiles.slice(0, 10),
    todayPicks: listed.slice(0, 8),
    mostLikedNft: liked.slice(0, 8).map((nft) => ({
      _id: nft.accountNumber || nft.Issuer,
      Nft: [nft]
    })),
    allNft: listed,
    allMintedNft: minted
  });
});

router.get("/nft/getNftDetail/:id", (req, res) => {
  const store = readStore();
  const nft = nftById(store, req.params.id);
  if (!nft) {
    return res.status(404).json({ success: false, message: "NFT not found" });
  }
  const datauser = store.profiles.find(
    (profile) => profile.wAddress === nft.accountNumber
  );
  const minData = store.profiles.find(
    (profile) => profile.wAddress === (nft.Issuer || nft.issuer)
  );
  res.json({
    success: true,
    data: nft,
    datauser: datauser || null,
    minData: minData || null,
    totalNft: store.nfts.filter(
      (item) => item.Issuer === nft.Issuer || item.issuer === nft.issuer
    ).length
  });
});

router.post(["/nft/getAllNftList", "/nft/getAllNftList/"], (req, res) => {
  const store = readStore();
  const page = Number(req.body?.page || req.body?.changePage || 1);
  const size = 12;
  const listed = store.nfts.filter((nft) => nft.status !== "hidden");
  const start = (page - 1) * size;
  res.json({
    success: true,
    data: listed.slice(start, start + size),
    allMintedNft: store.nfts,
    page,
    total: listed.length
  });
});

router.post("/nft/getTradeHistory/:id", (_req, res) => {
  res.json({ success: true, data: [] });
});

router.post("/nft/like", (req, res) => {
  const nftID = req.body?.nftID || req.body?.nftId;
  const store = update((current) => {
    const nft = nftById(current, nftID);
    if (nft) nft.likes = (nft.likes || 0) + 1;
    current.likes.push({ nftID, createdAt: new Date().toISOString() });
    return current;
  });
  res.json({
    success: true,
    message: "Liked",
    data: store.nfts.filter((nft) => nft.status === "sale")
  });
});

router.post("/profile/getProfile", (req, res) => {
  const store = readStore();
  const wAddress = req.body?.wAddress;
  const match = wAddress
    ? store.profiles.filter((profile) => profile.wAddress === wAddress)
    : store.profiles;
  res.json({
    success: true,
    allProfile: store.profiles,
    data: match[0] || null
  });
});

router.post("/profile/getvpoint", (req, res) => {
  const store = readStore();
  const wAddress = req.body?.wAddress;
  const rows = store.leaderboards.filter(
    (row) => !wAddress || row.wAddress === wAddress
  );
  res.json({
    success: true,
    vPointDetails: rows.length ? rows : [{ wAddress, totalVPoint: 0 }]
  });
});

router.post("/profile/scoreboardvpoint", (_req, res) => {
  const store = readStore();
  res.json({ success: true, data: store.leaderboards });
});

router.post("/profile/xiodashboard", (_req, res) => {
  const store = readStore();
  res.json({ success: true, data: store.leaderboards });
});

router.post("/profile/createprofile", (req, res) => {
  const body = req.body || {};
  if (!body.wAddress) {
    return res.status(400).json({ success: false, message: "wAddress required" });
  }
  const store = update((current) => {
    const existing = current.profiles.find((p) => p.wAddress === body.wAddress);
    if (existing) Object.assign(existing, body);
    else current.profiles.push({ _id: `profile-${body.wAddress}`, ...body });
    return current;
  });
  res.json({
    success: true,
    message: "Profile saved",
    data: store.profiles.find((p) => p.wAddress === body.wAddress)
  });
});

router.post("/collection/get/:page", (_req, res) => {
  res.json({ success: true, data: { docs: [], length: 0 } });
});

router.get("/collection/get/:name", (_req, res) => {
  res.json({ success: true, data: [] });
});

router.get("/xrpl/allMintedNft", (_req, res) => {
  const store = readStore();
  res.json({ success: true, data: store.nfts });
});

router.post("/logs", (_req, res) => {
  res.json({ success: true });
});

const stubPosts = [
  "xumm/connect",
  "xumm/accountDetail",
  "xumm/getBalance",
  "xumm/disConnect",
  "xumm/registrationFee",
  "xumm/checkRegistrationFee",
  "xrpl/mintNft",
  "xrpl/mintNftOffer",
  "xrpl/saleNft",
  "xrpl/buyNft",
  "xrpl/burnNft",
  "xrpl/sendNft",
  "nft/createNft",
  "mintoffer/create"
];

for (const pathName of stubPosts) {
  router.post(`/${pathName}`, (_req, res) => {
    res.status(200).json(notReady(pathName));
  });
}

export default router;
