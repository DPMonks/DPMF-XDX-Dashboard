import { Router } from "express";
import { readStore, update } from "../lib/store.js";
import { findTemplate, resolveNft, templates } from "../lib/collections.js";
import { activityFeed } from "../lib/market.js";
import {
  addComment,
  addDrop,
  addLaunch,
  addProposal,
  allowlistOk,
  batchList,
  bidDepth,
  collectionAnalytics,
  commentsFor,
  creatorRoyalties,
  discover,
  feeQuote,
  fileIntegrity,
  floorHistory,
  follow,
  homeRails,
  ingestExternal,
  portfolio,
  rarityForNft,
  reportItem,
  traderView,
  voteProposal
} from "../lib/v2.js";

const router = Router();

function mutate(res, run) {
  let result;
  update((current) => {
    result = run(current);
    return current;
  });
  res.status(result?.ok === false ? 400 : 200).json({ success: result?.ok !== false, ...result });
}

router.get("/discover", (req, res) => {
  res.json({ success: true, data: discover(readStore(), req.query) });
});

router.get("/rails", (_req, res) => {
  res.json({ success: true, data: homeRails(readStore()) });
});

router.get("/activity", (req, res) => {
  res.json({
    success: true,
    data: activityFeed(readStore(), {
      type: req.query.type,
      collection: req.query.collection,
      nftId: req.query.nftId,
      size: req.query.size || 40
    })
  });
});

router.get("/collections/:slug", (req, res) => {
  const store = readStore();
  const template = findTemplate(store, req.params.slug);
  if (!template) return res.status(404).json({ success: false, message: "collection not found" });
  res.json({
    success: true,
    data: {
      ...collectionAnalytics(store, template),
      banner: template.banner || template.image,
      description: template.description,
      activity: activityFeed(store, { collection: template.slug, size: 16 }).docs
    }
  });
});

router.get("/collections/:slug/floor", (req, res) => {
  const store = readStore();
  const template = findTemplate(store, req.params.slug);
  if (!template) return res.status(404).json({ success: false, message: "collection not found" });
  res.json({ success: true, data: floorHistory(store, template, req.query.range) });
});

router.get("/collections/:slug/rarity/:id", (req, res) => {
  const store = readStore();
  const nft = resolveNft(store, req.params.id);
  if (!nft) return res.status(404).json({ success: false, message: "NFT not found" });
  res.json({ success: true, data: rarityForNft(store, nft) });
});

router.get("/collections/:slug/bids", (req, res) => {
  res.json({ success: true, data: bidDepth(readStore(), req.params.slug) });
});

router.get("/portfolio/:address", (req, res) => {
  res.json({ success: true, data: portfolio(readStore(), req.params.address) });
});

router.get("/royalties/:address", (req, res) => {
  res.json({ success: true, data: creatorRoyalties(readStore(), req.params.address) });
});

router.get("/pro/:slug?", (req, res) => {
  const slug = req.params.slug || templates(readStore())[0]?.slug;
  res.json({ success: true, data: traderView(readStore(), slug) });
});

router.post("/list/batch", (req, res) => {
  mutate(res, (store) => batchList(store, req.body || {}));
});

router.get("/quote/:id", (req, res) => {
  const nft = resolveNft(readStore(), req.params.id);
  if (!nft) return res.status(404).json({ success: false, message: "NFT not found" });
  res.json({ success: true, data: feeQuote(nft), integrity: fileIntegrity(readStore(), nft) });
});

router.get("/nft/:id/social", (req, res) => {
  const store = readStore();
  res.json({
    success: true,
    data: {
      comments: commentsFor(store, req.params.id),
      follows: (store.follows || []).filter((row) => row.target === req.params.id)
    }
  });
});

router.post("/follow", (req, res) => mutate(res, (store) => follow(store, req.body || {})));
router.post("/comments", (req, res) => mutate(res, (store) => addComment(store, req.body || {})));
router.post("/report", (req, res) => mutate(res, (store) => reportItem(store, req.body || {})));

router.get("/moderation", (_req, res) => {
  const store = readStore();
  res.json({
    success: true,
    data: {
      reports: store.reports || [],
      launches: store.launches || [],
      verifications: store.verifications || []
    }
  });
});

router.get("/drops", (_req, res) => {
  res.json({ success: true, data: readStore().drops || [] });
});

router.get("/drops/:slug", (req, res) => {
  const drop = (readStore().drops || []).find(
    (row) => row.slug === req.params.slug || row._id === req.params.slug
  );
  if (!drop) return res.status(404).json({ success: false, message: "drop not found" });
  res.json({ success: true, data: drop });
});

router.post("/drops", (req, res) => mutate(res, (store) => addDrop(store, req.body || {})));
router.post("/launchpad", (req, res) => mutate(res, (store) => addLaunch(store, req.body || {})));
router.post("/allowlist/check", (req, res) => {
  res.json({ success: true, data: allowlistOk(readStore(), req.body || {}) });
});

router.get("/governance", (_req, res) => {
  const store = readStore();
  res.json({
    success: true,
    data: {
      proposals: store.proposals || [],
      votes: store.votes || []
    }
  });
});

router.post("/governance", (req, res) => mutate(res, (store) => addProposal(store, req.body || {})));
router.post("/governance/:id/vote", (req, res) => {
  mutate(res, (store) =>
    voteProposal(store, { proposalId: req.params.id, ...req.body })
  );
});

router.get("/aggregator", (_req, res) => {
  const store = readStore();
  res.json({
    success: true,
    data: store.aggregator || { sources: [], listings: [] }
  });
});

router.post("/aggregator/ingest", (req, res) => {
  mutate(res, (store) => ingestExternal(store, req.body || {}));
});

export default router;
