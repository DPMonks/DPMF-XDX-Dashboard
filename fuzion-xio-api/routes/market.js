import { Router } from "express";
import { readStore, update } from "../lib/store.js";
import { findTemplate, resolveNft } from "../lib/collections.js";
import {
  acceptOffer,
  activityFeed,
  bidAuction,
  browseCollection,
  buyNow,
  cancelOffer,
  collectionStats,
  delist,
  exploreCollections,
  listForSale,
  openOffers,
  placeOffer,
  rankings,
  runSweep,
  searchMarket,
  startAuction,
  sweepPlan,
  toggleWatch,
  traitFacets
} from "../lib/market.js";

const router = Router();

router.get("/", (_req, res) => {
  const store = readStore();
  res.json({
    success: true,
    desk: "FUZION-XIO market",
    platformFeeBps: 0,
    collections: exploreCollections(store),
    activity: (store.activity || []).slice(0, 12),
    auctions: (store.auctions || []).filter((row) => row.status === "live"),
    offers: (store.offers || []).filter((row) => row.status === "open").slice(0, 12)
  });
});

router.get("/explore", (_req, res) => {
  res.json({ success: true, data: exploreCollections(readStore()) });
});

router.get("/rankings", (_req, res) => {
  res.json({ success: true, data: rankings(readStore()) });
});

router.get("/activity", (req, res) => {
  res.json({ success: true, data: activityFeed(readStore(), req.query) });
});

router.get("/search", (req, res) => {
  res.json({ success: true, data: searchMarket(readStore(), req.query.q) });
});

router.get("/offers", (req, res) => {
  res.json({ success: true, data: openOffers(readStore(), req.query) });
});

router.get("/auctions", (_req, res) => {
  res.json({
    success: true,
    data: (readStore().auctions || []).filter((row) => row.status === "live")
  });
});

router.get("/collection/:name", (req, res) => {
  const store = readStore();
  const template = findTemplate(store, req.params.name);
  if (!template) {
    return res.status(404).json({ success: false, message: "collection not found" });
  }
  res.json({
    success: true,
    data: browseCollection(store, req.params.name, {
      page: req.query.page,
      size: req.query.size,
      filter: req.query.filter,
      sort: req.query.sort,
      minPrice: req.query.minPrice,
      maxPrice: req.query.maxPrice,
      traits: {
        Finish: req.query.finish,
        Palette: req.query.palette,
        Band: req.query.band
      }
    }),
    stats: collectionStats(store, template),
    facets: traitFacets(store, template)
  });
});

router.post("/collection/:name/browse", (req, res) => {
  const store = readStore();
  const data = browseCollection(store, req.params.name, req.body || {});
  if (!data) return res.status(404).json({ success: false, message: "collection not found" });
  res.json({ success: true, data });
});

router.get("/collection/:name/stats", (req, res) => {
  const store = readStore();
  const template = findTemplate(store, req.params.name);
  if (!template) return res.status(404).json({ success: false, message: "collection not found" });
  res.json({ success: true, data: collectionStats(store, template) });
});

router.get("/nft/:id", (req, res) => {
  const store = readStore();
  const nft = resolveNft(store, req.params.id);
  if (!nft) return res.status(404).json({ success: false, message: "NFT not found" });
  res.json({
    success: true,
    data: nft,
    offers: openOffers(store, { nftId: nft._id }),
    activity: activityFeed(store, { nftId: nft._id, size: 20 }).docs
  });
});

function mutate(res, run) {
  let result;
  update((current) => {
    result = run(current);
    return current;
  });
  res.status(result?.ok === false ? 400 : 200).json({ success: result?.ok !== false, ...result });
}

router.post("/list", (req, res) => {
  mutate(res, (store) => listForSale(store, req.body || {}));
});

router.post("/delist", (req, res) => {
  mutate(res, (store) => delist(store, req.body || {}));
});

router.post("/buy", (req, res) => {
  mutate(res, (store) => ({
    ...buyNow(store, req.body || {}),
    note: "Paper fill on the local desk. Xaman signs the same path when keys are present."
  }));
});

router.post("/offer", (req, res) => {
  mutate(res, (store) => placeOffer(store, req.body || {}));
});

router.post("/offer/:id/cancel", (req, res) => {
  mutate(res, (store) => cancelOffer(store, req.params.id));
});

router.post("/offer/:id/accept", (req, res) => {
  mutate(res, (store) => acceptOffer(store, req.params.id, req.body?.seller));
});

router.post("/auction", (req, res) => {
  mutate(res, (store) => startAuction(store, req.body || {}));
});

router.post("/auction/:id/bid", (req, res) => {
  mutate(res, (store) => bidAuction(store, { auctionId: req.params.id, ...req.body }));
});

router.get("/sweep/:name", (req, res) => {
  res.json({
    success: true,
    data: sweepPlan(readStore(), req.params.name, {
      count: req.query.count,
      maxPrice: req.query.maxPrice
    })
  });
});

router.post("/sweep/:name", (req, res) => {
  mutate(res, (store) => runSweep(store, req.params.name, req.body || {}));
});

router.post("/watch", (req, res) => {
  mutate(res, (store) => toggleWatch(store, req.body || {}));
});

export default router;
