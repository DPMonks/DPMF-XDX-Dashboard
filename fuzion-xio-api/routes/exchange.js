import { Router } from "express";
import { readStore, update } from "../lib/store.js";
import { capabilityMap } from "../lib/capabilities.js";
import {
  collectionCount,
  featuredFromTemplates,
  pageShape,
  resolveNft,
  templateCards
} from "../lib/collections.js";
import { xioRank, vScoreBadge } from "../lib/governance.js";
import {
  addressValidation,
  applyValidation,
  nftValidation,
  withNftValidation
} from "../lib/validation.js";
import { indexerGet, walletTokenData } from "../lib/indexer.js";
import { tradeCatalog } from "../lib/assets.js";
import {
  enrichAddress,
  vScoreDashboardRows,
  xioDashboardRows
} from "../lib/profile.js";
import { accountLines, accountNfts, nftInfo, serverInfo } from "../lib/xrpl.js";
import { browseCollection, activityFeed, openOffers } from "../lib/market.js";
import {
  addPin,
  pinsForNft,
  profileNftDesk,
  removePin,
  snapshotFromBody
} from "../lib/profileNfts.js";
import { rememberWalletNfts, walletNftDesk } from "../lib/walletNfts.js";

const router = Router();

function notReady(feature) {
  return {
    success: false,
    implemented: false,
    message: `${feature} is not wired yet. The local exchange is a fresh foundation; Xaman/ledger signing comes next.`
  };
}

function nftById(store, id) {
  return resolveNft(store, id);
}

function listedNfts(store) {
  return (store.nfts || []).filter((nft) => nft.status === "sale");
}

function validatorFromReq(req) {
  if (req.body?.from || req.body?.account || req.body?.wAddress) {
    return req.body.from || req.body.account || req.body.wAddress;
  }
  const header = String(req.headers.authorization || "").replace(/^Basic\s+/i, "");
  if (!header || header.split(".").length < 2) return "";
  try {
    const payload = JSON.parse(Buffer.from(header.split(".")[1], "base64url").toString());
    return payload.ac || payload.address || "";
  } catch {
    return "";
  }
}

router.get("/health", (_req, res) => {
  const store = readStore();
  const virtualSupply = (store.collectionTemplates || []).reduce(
    (sum, item) => sum + Number(item.size || 0),
    0
  );
  res.json({
    ok: true,
    service: "fuzion-xio-api",
    version: store.version || 0,
    nfts: store.nfts.length,
    profiles: store.profiles.length,
    collections: (store.collectionTemplates || []).length,
    virtualSupply
  });
});

router.get("/capabilities", (_req, res) => {
  const store = readStore();
  res.json({
    success: true,
    ...capabilityMap(),
    catalog: {
      listed: listedNfts(store).length,
      minted: store.nfts.length,
      collections: (store.collectionTemplates || []).map((item) => ({
        slug: item.slug,
        name: item.collectionName,
        size: item.size,
        fileType: item.fileType,
        program: item.program
      }))
    }
  });
});

router.get("/tokens", async (req, res) => {
  const book = await tradeCatalog(req.query.address);
  res.json({
    ok: true,
    source: book.source,
    tokens: book.assets,
    count: book.count,
    prices: book.prices,
    indexerStatus: book.source?.indexer
  });
});

router.get("/indexer", async (_req, res) => {
  const root = await indexerGet("/");
  res.json(root);
});

router.get("/indexer/overview", async (_req, res) => {
  res.json(await indexerGet("/api/overview"));
});

router.get("/indexer/prices", async (_req, res) => {
  res.json(await indexerGet("/api/prices"));
});

router.get("/indexer/wallet/:address", async (req, res) => {
  res.json(await walletTokenData(req.params.address));
});

router.get("/xrpl/server", async (_req, res) => {
  res.json(await serverInfo());
});

router.get("/xrpl/account/:address/nfts", async (req, res) => {
  res.json(await accountNfts(req.params.address, req.query.marker));
});

router.get("/xrpl/account/:address/lines", async (req, res) => {
  res.json(await accountLines(req.params.address));
});

router.get("/xrpl/nft/:nftId", async (req, res) => {
  res.json(await nftInfo(req.params.nftId));
});

router.get("/nft/home", (_req, res) => {
  const store = readStore();
  const listed = listedNfts(store);
  const featured = featuredFromTemplates(store, 1);
  const liked = [...store.nfts].sort((a, b) => (b.likes || 0) - (a.likes || 0));
  const homeListed = [...listed, ...featured.filter((item) => item.status === "sale")];
  const uniqueHome = [];
  const seen = new Set();
  for (const nft of homeListed) {
    const key = nft.name || nft._id;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueHome.push(
      withNftValidation(store, {
        ...nft,
        contentType: nft.contentType || nft.fileType
      })
    );
  }
  res.json({
    success: true,
    message: "All NFT",
    rcTop: uniqueHome.slice(0, 8),
    sallingCreater: store.profiles.slice(0, 10),
    todayPicks: uniqueHome.slice(0, 8),
    mostLikedNft: liked.slice(0, 8).map((nft) => ({
      _id: nft.accountNumber || nft.Issuer,
      Nft: [nft]
    })),
    allNft: uniqueHome,
    allMintedNft: [...store.nfts, ...templateCards(store)].map((nft) =>
      withNftValidation(store, nft)
    ),
    ledgerMints: store.ledgerMints || []
  });
});

router.get("/nft/getNftDetail/:id", async (req, res) => {
  const store = readStore();
  const nft = nftById(store, req.params.id);
  if (!nft) {
    return res.status(404).json({ success: false, message: "NFT not found" });
  }
  const owner = store.profiles.find((profile) => profile.wAddress === nft.accountNumber);
  const issuer = store.profiles.find(
    (profile) => profile.wAddress === (nft.Issuer || nft.issuer)
  );
  const issuerAddress = nft.Issuer || nft.issuer;
  const issuerGov = await enrichAddress(store, issuerAddress);
  let ledger = null;
  if (nft.NFTokenID && !nft.virtual) {
    const info = await nftInfo(nft.NFTokenID);
    ledger = info.ok ? info.result : null;
  }
  res.json({
    success: true,
    data: {
      ...nft,
      issuerRank: issuerGov.rank,
      issuerBadge: issuerGov.badge,
      issuerVScore: issuerGov.vScore,
      validation: nftValidation(store, nft),
      threeD: ["glb", "gltf", "fbx", "usdz"].includes(nft.fileType)
    },
    datauser: owner || null,
    minData: issuer || null,
    governance: issuerGov,
    ledger,
    totalNft: nft.collectionSize || collectionCount(store, nft.collectionName || nft.name)
  });
});

router.post(["/nft/getAllNftList", "/nft/getAllNftList/"], (req, res) => {
  const store = readStore();
  const page = Number(req.body?.page || req.body?.changePage || 1);
  const size = 12;
  const listed = (store.nfts || []).filter((nft) => nft.status !== "hidden");
  const start = (page - 1) * size;
  res.json({
    success: true,
    data: listed.slice(start, start + size),
    allMintedNft: [...store.nfts, ...templateCards(store)],
    page,
    total: listed.length
  });
});

router.post("/nft/getCollectionsByName", (req, res) => {
  const store = readStore();
  const page = Number(req.body?.page || 1);
  const filter = req.body?.activeFilter || "all";
  const name = req.body?.collectionName;
  const browsed = browseCollection(store, name, {
    page,
    filter,
    sort: req.body?.sort,
    traits: req.body?.traits,
    minPrice: req.body?.minPrice,
    maxPrice: req.body?.maxPrice
  });
  if (browsed) {
    return res.json({ success: true, data: browsed });
  }
  const rows = (store.nfts || []).filter((nft) => {
    const match =
      String(nft.collectionName || "").toLowerCase() === String(name || "").toLowerCase();
    if (!match) return false;
    if (filter === "all") return true;
    return nft.status === filter;
  });
  const size = 12;
  const start = (page - 1) * size;
  res.json({
    success: true,
    data: pageShape(rows.slice(start, start + size), page, size, rows.length)
  });
});

router.post("/nft/getTradeHistory/:id", (req, res) => {
  const store = readStore();
  const rows = (store.tradehistories || []).filter(
    (row) => row.nftID === req.params.id || row.NFTokenID === req.params.id
  );
  const tape = activityFeed(store, { nftId: req.params.id, size: 50 }).docs;
  res.json({ success: true, data: rows.length ? rows : tape });
});

router.post("/nft/like", (req, res) => {
  const nftID = req.body?.nftID || req.body?.nftId;
  const store = update((current) => {
    const nft = (current.nfts || []).find(
      (item) => item._id === nftID || item.NFTokenID === nftID
    );
    if (nft) nft.likes = (nft.likes || 0) + 1;
    current.likes.push({ nftID, createdAt: new Date().toISOString() });
    return current;
  });
  res.json({
    success: true,
    message: "Liked",
    data: listedNfts(store)
  });
});

router.post("/nft/updateNftinfo/:id", (req, res) => {
  const store = update((current) => {
    const nft = (current.nfts || []).find(
      (item) => item._id === req.params.id || item.NFTokenID === req.params.id
    );
    if (nft) Object.assign(nft, req.body || {});
    return current;
  });
  const nft = nftById(store, req.params.id);
  res.json({ success: Boolean(nft), data: nft || null });
});

router.patch("/nft/removeNftCollection", (req, res) => {
  const { collectionName, accountNumber } = req.body || {};
  const store = update((current) => {
    current.collections = (current.collections || []).filter(
      (row) =>
        !(
          row.collectionName === collectionName &&
          (!accountNumber || row.accountNumber === accountNumber)
        )
    );
    return current;
  });
  res.json({ success: true, data: store.collections });
});

router.get("/nft/convert", (req, res) => {
  const ipfsUrl = req.query.ipfsUrl;
  res.json({
    success: true,
    implemented: false,
    ipfsUrl,
    dataUri: null,
    usdzUrl: null,
    message:
      "USDZ conversion is not wired on the local API. iOS AR uses usdzUrl on the NFT when present."
  });
});

router.post("/profile/getProfile", async (req, res) => {
  const store = readStore();
  const wAddress = req.body?.wAddress;
  const match = wAddress
    ? store.profiles.filter((profile) => profile.wAddress === wAddress)
    : store.profiles;
  const enriched = wAddress ? await enrichAddress(store, wAddress) : null;
  res.json({
    success: true,
    allProfile: store.profiles,
    data: match[0] || (wAddress ? { wAddress } : null),
    governance: enriched
  });
});

router.post("/profile/getvpoint", (req, res) => {
  const store = readStore();
  const wAddress = req.body?.wAddress;
  const addresses = wAddress
    ? [wAddress]
    : (store.leaderboards || []).map((row) => row.wAddress);
  res.json({
    success: true,
    vPointDetails: addresses.map((address) => {
      const state = addressValidation(store, address);
      return {
        wAddress: address,
        totalVPoint: state.vScore,
        badge: state.badge,
        rank: state.rank,
        validator: xioDashboardRows(store).find((item) => item.accountNumber === address)
      };
    })
  });
});

function vScorePayload(_req, res) {
  const store = readStore();
  res.json({
    success: true,
    data: store.leaderboards,
    vscoreDashboard: vScoreDashboardRows(store)
  });
}

router.post("/profile/scoreboardvpoint", vScorePayload);
router.get("/profile/scoreboardvpoint", vScorePayload);

function xioPayload(_req, res) {
  const store = readStore();
  res.json({
    success: true,
    data: store.leaderboards,
    xioDashboardData: xioDashboardRows(store)
  });
}

router.post("/profile/xiodashboard", xioPayload);
router.get("/profile/xiodashboard", xioPayload);

router.post("/profile/getbalanceandlevel", async (req, res) => {
  const store = readStore();
  const address = req.body?.wAddress;
  if (!address) {
    return res.status(400).json({ success: false, message: "wAddress required" });
  }
  const gov = await enrichAddress(store, address);
  res.json({
    success: true,
    data: {
      rdxBalance: gov.xioBalance,
      level: gov.rank,
      xioBalance: gov.xioBalance,
      rank: gov.rank,
      badge: gov.badge,
      tokens: gov.tokens
    }
  });
});

router.post("/profile/verifyprofile", (req, res) => {
  const to = req.body?.dWalletAdd || req.body?.to;
  const from = validatorFromReq(req);
  let result;
  update((current) => {
    result = applyValidation(current, {
      from,
      to,
      currency: req.body?.currency,
      amount: req.body?.amount
    });
    return current;
  });
  if (!result?.ok) {
    return res.status(400).json({ success: false, message: result?.error || "Validation failed" });
  }
  res.json({
    success: true,
    message: result.message,
    data: result
  });
});

router.post("/profile/verifyprofilestatus", (_req, res) => {
  res.json({ success: true, message: "Validation recorded on the local desk." });
});

router.post("/profile/createfbxfile", (_req, res) => {
  res.status(200).json({
    success: true,
    implemented: false,
    message: "FBX staging is not wired locally. Mint still accepts a hosted GLB/FBX URL."
  });
});

router.post("/profile/cleanup-staged-uploads", (_req, res) => {
  res.json({ success: true });
});

router.get("/governance/:address", async (req, res) => {
  const store = readStore();
  res.json({
    success: true,
    data: await enrichAddress(store, req.params.address),
    ranks: [
      { rank: "New Validator", min: 0.0001, max: 0.001 },
      { rank: "Beginner Validator", min: 0.001, max: 0.01 },
      { rank: "Basic Validator", min: 0.01, max: 0.1 },
      { rank: "Validator", min: 0.1, max: 1 },
      { rank: "Active Validator", min: 1, max: 10 },
      { rank: "Trusted Validator", min: 10, max: 100 },
      { rank: "Master Validator", min: 100, max: null }
    ],
    badges: { tick: vScoreBadge(0), blue: vScoreBadge(100), gold: vScoreBadge(10000) }
  });
});

router.post("/collection/create", (req, res) => {
  const body = req.body || {};
  const nftId = body.Id || body.nftId || body.nftDetail?._id;
  const address = body.wAddress || body.walletAddress || body.walletAddr;
  if (!nftId || !address) {
    return res.status(400).json({ success: false, message: "nft id and wAddress required" });
  }
  let pinned = null;
  update((current) => {
    const nft = resolveNft(current, nftId) || snapshotFromBody(body);
    if (!nft) return current;
    pinned = addPin(current, address, nft);
    return current;
  });
  if (!pinned) {
    return res.status(404).json({ success: false, message: "NFT not found" });
  }
  res.json({
    success: true,
    message: "NFT added to profile",
    data: null
  });
});

router.post("/collection/get/:page", async (req, res) => {
  const store = readStore();
  const key = req.body?.walletAddress || req.body?.Id || req.body?.nftId;
  if (key && resolveNft(store, key)) {
    return res.json({
      success: true,
      data: { docs: pinsForNft(store, key) }
    });
  }
  if (key) {
    const desk = await profileNftDesk(store, key);
    return res.json({ success: true, data: desk });
  }
  const page = Number(req.params.page || 1);
  const size = 12;
  const cards = [...templateCards(store), ...(store.collections || [])];
  const start = (page - 1) * size;
  res.json({
    success: true,
    data: pageShape(cards.slice(start, start + size), page, size, cards.length)
  });
});

router.post("/nft/getSingleUserNftsByCollections", async (req, res) => {
  const address = req.body?.walletAddress || req.body?.wAddress;
  if (!address) {
    return res.status(400).json({ success: false, message: "walletAddress required" });
  }
  const desk = await profileNftDesk(readStore(), address);
  res.json({ success: true, data: desk });
});

router.post("/nft/getSingleUserNfts", async (req, res) => {
  const address =
    req.body?.wAddress || req.body?.walletAddress || validatorFromReq(req);
  if (!address) {
    return res.status(400).json({ success: false, message: "wallet required" });
  }
  const desk = await walletNftDesk(readStore(), address, req.body || req.query);
  update((current) => {
    rememberWalletNfts(current, desk.docs);
    return current;
  });
  res.json({ success: true, data: desk });
});

router.get("/nft/getSingleUserNfts", async (req, res) => {
  const address = req.query.wAddress || req.query.walletAddress || validatorFromReq(req);
  if (!address) {
    return res.status(400).json({ success: false, message: "wallet required" });
  }
  const desk = await walletNftDesk(readStore(), address, req.query);
  res.json({ success: true, data: desk });
});

router.get("/collection/get/:name", (req, res) => {
  const store = readStore();
  const name = decodeURIComponent(req.params.name || "");
  const count = collectionCount(store, name);
  res.json({
    success: true,
    data: { length: count }
  });
});

router.delete("/collection/delete/:payload", (req, res) => {
  let parsed = {};
  try {
    parsed = JSON.parse(req.params.payload);
  } catch {
    parsed = { Id: req.params.payload };
  }
  const nftId = parsed.Id || parsed.id || parsed.nftId;
  const address = parsed.wAddress || parsed.walletAddress;
  if (nftId) {
    update((current) => {
      if (address) {
        removePin(current, address, nftId);
        return current;
      }
      for (const profile of current.profiles || []) {
        const hit = (profile.profileNfts || []).some(
          (pin) => pin._id === nftId || pin.nftId === nftId || pin.NFTokenID === nftId
        );
        if (hit) removePin(current, profile.wAddress, nftId);
      }
      return current;
    });
    return res.json({
      success: true,
      message: "NFT removed from profile",
      deleted: true,
      data: null
    });
  }
  update((current) => {
    current.collections = (current.collections || []).filter(
      (row) => row._id !== parsed.Id && row._id !== parsed.id
    );
    return current;
  });
  res.json({
    success: true,
    message: "NFT removed from profile",
    deleted: true,
    data: null
  });
});

router.get("/xrpl/allMintedNft", (_req, res) => {
  const store = readStore();
  res.json({ success: true, data: store.nfts });
});

router.get("/assets", async (req, res) => {
  const target = req.query.url;
  if (!target) {
    return res.status(400).json({ success: false, message: "url required" });
  }
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return res.status(400).json({ success: false, message: "invalid url" });
  }
  const allowed = [
    "ipfs.io",
    "radical-x.infura-ipfs.io",
    "picsum.photos",
    "modelviewer.dev",
    "fuzion-xio.com",
    "www.dpmf.technology",
    "dpmf.technology",
    "interactive-examples.mdn.mozilla.net",
    "www.w3.org",
    "w3.org",
    "www.gstatic.com",
    "gstatic.com",
    "dweb.link",
    "w3s.link",
    "gateway.pinata.cloud"
  ];
  if (!allowed.includes(parsed.hostname)) {
    return res.status(400).json({ success: false, message: "host not allowed" });
  }
  try {
    const upstream = await fetch(parsed.toString());
    if (!upstream.ok) {
      return res.status(upstream.status).json({ success: false, message: "upstream failed" });
    }
    res.setHeader(
      "content-type",
      upstream.headers.get("content-type") || "application/octet-stream"
    );
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    res.status(502).json({ success: false, message: String(error.message || error) });
  }
});

router.post("/logs", (_req, res) => {
  res.json({ success: true });
});

router.post("/xrpl/getAllOffers", (req, res) => {
  res.json({ success: true, data: openOffers(readStore(), req.body || {}) });
});

router.post("/nft/totalTradeHistory", (_req, res) => {
  res.json({ success: true, data: readStore().activity || [] });
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
  "xrpl/sendNft"
];

for (const pathName of stubPosts) {
  router.post(`/${pathName}`, (_req, res) => {
    res.status(200).json(notReady(pathName));
  });
}

export default router;
