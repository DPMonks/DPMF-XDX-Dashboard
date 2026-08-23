import { randomUUID } from "node:crypto";
import {
  findTemplate,
  hydrate,
  itemStatus,
  materialize,
  pageShape,
  resolveNft,
  templates
} from "./collections.js";
import { assetsLabel, offerAssets } from "./currency.js";
import { PLATFORM_FEE_BPS, recordFees, splitTrade } from "./fees.js";
import { ensureTrustlines } from "./wallet.js";

export { PLATFORM_FEE_BPS };
export const DEFAULT_ROYALTY_BPS = 500;

function nowIso() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export function ensureMarket(store) {
  store.offers = store.offers || [];
  store.bids = store.bids || [];
  store.auctions = store.auctions || [];
  store.activity = store.activity || [];
  store.watchlist = store.watchlist || [];
  store.listingOverrides = store.listingOverrides || {};
  store.tradehistories = store.tradehistories || [];
  store.knownAssets = store.knownAssets || [];
  store.fees = store.fees || [];
  store.wallets = store.wallets || [];
  return store;
}

function priceOf(nft) {
  const n = Number(nft?.amount);
  return Number.isFinite(n) ? n : 0;
}

function matchesTraits(nft, traits = {}) {
  const wanted = Object.entries(traits).filter(([, value]) => value);
  if (!wanted.length) return true;
  return wanted.every(([type, value]) =>
    (nft.traits || []).some(
      (trait) =>
        String(trait.trait_type).toLowerCase() === String(type).toLowerCase() &&
        String(trait.value).toLowerCase() === String(value).toLowerCase()
    )
  );
}

export function listedItems(store, template) {
  const rows = [];
  for (let index = 1; index <= template.size; index += 1) {
    const nft = materialize(template, index, store);
    if (nft.status === "sale") rows.push(nft);
  }
  return rows;
}

export function traitFacets(store, template) {
  const counts = {};
  const sample = Math.min(template.size, 1000);
  for (let index = 1; index <= sample; index += 1) {
    const nft = materialize(template, index, store);
    for (const trait of nft.traits || []) {
      if (trait.trait_type === "Collection") continue;
      counts[trait.trait_type] = counts[trait.trait_type] || {};
      counts[trait.trait_type][trait.value] =
        (counts[trait.trait_type][trait.value] || 0) + 1;
    }
  }
  return Object.entries(counts).map(([trait_type, values]) => ({
    trait_type,
    values: Object.entries(values)
      .map(([value, count]) => ({
        value,
        count,
        rarity: +(count / sample).toFixed(4)
      }))
      .sort((a, b) => b.count - a.count)
  }));
}

export function collectionStats(store, template) {
  const listed = listedItems(store, template);
  const prices = listed.map(priceOf).filter((n) => n > 0).sort((a, b) => a - b);
  const sales = (store.activity || []).filter(
    (row) =>
      row.type === "sale" &&
      (row.collectionSlug === template.slug ||
        row.collectionName === template.collectionName)
  );
  const volume = sales.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const offers = (store.offers || []).filter(
    (row) =>
      row.status === "open" &&
      (row.collectionSlug === template.slug || row.kind === "collection")
  );
  const bestOffer = offers
    .map((row) => Number(row.amount) || 0)
    .sort((a, b) => b - a)[0];
  return {
    slug: template.slug,
    name: template.collectionName,
    size: template.size,
    fileType: template.fileType,
    currency: template.currency,
    listed: listed.length,
    minted: Array.from({ length: template.size }, (_, i) =>
      itemStatus(i + 1)
    ).filter((status) => status !== "created").length,
    floor: prices[0] ?? null,
    ceiling: prices[prices.length - 1] ?? null,
    volume: +volume.toFixed(4),
    sales: sales.length,
    bestOffer: bestOffer ?? null,
    owners: new Set(listed.map((nft) => nft.accountNumber)).size,
    royaltyBps: template.royaltyBps || DEFAULT_ROYALTY_BPS,
    platformFeeBps: PLATFORM_FEE_BPS,
    verified: template.verified === true
  };
}

export function browseCollection(store, name, query = {}) {
  const template = findTemplate(store, name);
  if (!template) return null;
  const filter = query.filter || query.activeFilter || "all";
  const traits = query.traits || {};
  const min = query.minPrice != null ? Number(query.minPrice) : null;
  const max = query.maxPrice != null ? Number(query.maxPrice) : null;
  const sort = query.sort || "price_asc";
  const facets = traitFacets(store, template);
  const rarityLookup = {};
  for (const facet of facets) {
    for (const value of facet.values) {
      rarityLookup[`${facet.trait_type}:${value.value}`] = value.rarity;
    }
  }
  const rarityScoreOf = (nft) => {
    const listed = (nft.traits || []).filter((trait) => trait.trait_type !== "Collection");
    if (!listed.length) return 0;
    return (
      listed.reduce(
        (sum, trait) =>
          sum + (1 - (rarityLookup[`${trait.trait_type}:${trait.value}`] || 1)),
        0
      ) / listed.length
    );
  };
  const rows = [];
  for (let index = 1; index <= template.size; index += 1) {
    const nft = materialize(template, index, store);
    if (filter !== "all" && nft.status !== filter) continue;
    if (!matchesTraits(nft, traits)) continue;
    const price = priceOf(nft);
    if (min != null && price < min) continue;
    if (max != null && price > max) continue;
    rows.push({
      ...nft,
      rarityScore: +rarityScoreOf(nft).toFixed(4)
    });
  }
  const rarityOrder = [...rows].sort((a, b) => b.rarityScore - a.rarityScore);
  const rarityRank = new Map(rarityOrder.map((nft, index) => [nft._id, index + 1]));
  rows.sort((a, b) => {
    if (sort === "price_desc") return priceOf(b) - priceOf(a);
    if (sort === "recent") return String(b.createdAt).localeCompare(String(a.createdAt));
    if (sort === "likes") return (b.likes || 0) - (a.likes || 0);
    if (sort === "rarity") return b.rarityScore - a.rarityScore || a.name.localeCompare(b.name);
    return priceOf(a) - priceOf(b);
  });
  const page = Number(query.page || 1);
  const size = Number(query.size || 12);
  const start = (page - 1) * size;
  const docs = rows.slice(start, start + size).map((nft) => ({
    ...nft,
    rarityRank: rarityRank.get(nft._id)
  }));
  return {
    ...pageShape(docs, page, size, rows.length),
    collectionName: template.collectionName,
    slug: template.slug,
    fileType: template.fileType,
    stats: collectionStats(store, template),
    facets
  };
}

export function exploreCollections(store) {
  return templates(store).map((template) => ({
    ...collectionStats(store, template),
    image: template.image,
    metaverse: template.metaverse,
    category: template.category
  }));
}

export function sweepPlan(store, name, { count = 5, maxPrice } = {}) {
  const template = findTemplate(store, name);
  if (!template) return { ok: false, error: "collection not found" };
  const cap = maxPrice != null ? Number(maxPrice) : Infinity;
  const picks = listedItems(store, template)
    .filter((nft) => priceOf(nft) > 0 && priceOf(nft) <= cap)
    .sort((a, b) => priceOf(a) - priceOf(b))
    .slice(0, Math.max(1, Number(count) || 1));
  const total = picks.reduce((sum, nft) => sum + priceOf(nft), 0);
  return {
    ok: true,
    collection: template.collectionName,
    currency: template.currency,
    count: picks.length,
    total: +total.toFixed(4),
    platformFeeBps: PLATFORM_FEE_BPS,
    items: picks.map((nft) => ({
      _id: nft._id,
      name: nft.name,
      amount: nft.amount,
      currency: nft.currency
    }))
  };
}

export function pushActivity(store, event) {
  ensureMarket(store);
  store.activity.unshift({
    _id: id("act"),
    createdAt: nowIso(),
    platformFeeBps: PLATFORM_FEE_BPS,
    ...event
  });
  store.activity = store.activity.slice(0, 500);
  return store.activity[0];
}

export function listForSale(store, { nftId, amount, currency, seller }) {
  ensureMarket(store);
  const nft = resolveNft(store, nftId);
  if (!nft) return { ok: false, error: "NFT not found" };
  const patch = {
    status: "sale",
    amount: String(amount ?? nft.amount),
    currency: currency || nft.currency,
    accountNumber: seller || nft.accountNumber
  };
  if (nft.virtual) store.listingOverrides[nft._id] = { ...store.listingOverrides[nft._id], ...patch };
  else {
    const row = store.nfts.find((item) => item._id === nft._id);
    if (row) Object.assign(row, patch);
  }
  const activity = pushActivity(store, {
    type: "list",
    nftId: nft._id,
    name: nft.name,
    collectionName: nft.collectionName,
    collectionSlug: nft.collectionSlug,
    amount: patch.amount,
    currency: patch.currency,
    from: patch.accountNumber
  });
  return { ok: true, nft: hydrate(store, { ...nft, ...patch }), activity };
}

export function burnNft(store, { nftId, from }) {
  ensureMarket(store);
  const nft = resolveNft(store, nftId);
  if (!nft) return { ok: false, error: "NFT not found" };
  if (
    from &&
    nft.accountNumber !== from &&
    nft.issuer !== from &&
    nft.Issuer !== from
  ) {
    return { ok: false, error: "not the owner or issuer" };
  }
  const patch = { status: "burned" };
  if (nft.virtual) {
    store.listingOverrides[nft._id] = { ...store.listingOverrides[nft._id], ...patch };
  } else {
    const row = store.nfts.find((item) => item._id === nft._id);
    if (row) Object.assign(row, patch);
  }
  const activity = pushActivity(store, {
    type: "burn",
    nftId: nft._id,
    name: nft.name,
    collectionName: nft.collectionName,
    from: from || nft.accountNumber
  });
  return { ok: true, nft: { ...nft, ...patch }, activity };
}

export function delist(store, { nftId }) {
  ensureMarket(store);
  const nft = resolveNft(store, nftId);
  if (!nft) return { ok: false, error: "NFT not found" };
  const patch = { status: "minted" };
  if (nft.virtual) store.listingOverrides[nft._id] = { ...store.listingOverrides[nft._id], ...patch };
  else {
    const row = store.nfts.find((item) => item._id === nft._id);
    if (row) row.status = "minted";
  }
  const activity = pushActivity(store, {
    type: "delist",
    nftId: nft._id,
    name: nft.name,
    collectionName: nft.collectionName,
    collectionSlug: nft.collectionSlug,
    from: nft.accountNumber
  });
  return { ok: true, activity };
}

export function buyNow(store, { nftId, buyer, skipFee = false }) {
  ensureMarket(store);
  const nft = resolveNft(store, nftId);
  if (!nft) return { ok: false, error: "NFT not found" };
  if (nft.status !== "sale") return { ok: false, error: "not listed" };
  const seller = nft.accountNumber;
  const patch = { status: "minted", accountNumber: buyer || "rFuzionXioDemoBidder1111111111111" };
  if (nft.virtual) store.listingOverrides[nft._id] = { ...store.listingOverrides[nft._id], ...patch };
  else {
    const row = store.nfts.find((item) => item._id === nft._id);
    if (row) Object.assign(row, patch);
  }
  const assets = offerAssets({
    amount: nft.amount,
    currency: nft.currency,
    issuer: nft.issuer || nft.Issuer
  });
  const fees = skipFee
    ? []
    : recordFees(store, {
        assets,
        from: patch.accountNumber,
        to: seller,
        nftId: nft._id,
        type: "sale"
      });
  ensureTrustlines(store, { address: patch.accountNumber, assets });
  const split = skipFee ? { fee: 0, net: Number(nft.amount) || 0 } : splitTrade(nft.amount);
  store.tradehistories.push({
    nftID: nft._id,
    NFTokenID: nft.NFTokenID,
    amount: nft.amount,
    currency: nft.currency,
    fee: split.fee,
    net: split.net,
    platformFeeBps: PLATFORM_FEE_BPS,
    from: seller,
    to: patch.accountNumber,
    createdAt: nowIso(),
    type: "sale"
  });
  const activity = pushActivity(store, {
    type: "sale",
    nftId: nft._id,
    name: nft.name,
    collectionName: nft.collectionName,
    collectionSlug: nft.collectionSlug,
    amount: nft.amount,
    currency: nft.currency,
    fee: split.fee,
    net: split.net,
    platformFeeBps: PLATFORM_FEE_BPS,
    from: seller,
    to: patch.accountNumber,
    royaltyBps: nft.royaltyBps || DEFAULT_ROYALTY_BPS
  });
  return { ok: true, activity, simulated: true, fees, fee: split };
}

export function placeOffer(store, body) {
  ensureMarket(store);
  const kind = body.kind === "collection" ? "collection" : "item";
  const nft = body.nftId ? resolveNft(store, body.nftId) : null;
  if (kind === "item" && !nft) return { ok: false, error: "NFT not found" };
  const assets = offerAssets(body, nft?.currency || "XRP");
  if (!assets.length) return { ok: false, error: "amount required" };
  const first = assets[0];
  const offer = {
    _id: id("off"),
    kind,
    nftId: nft?._id || null,
    name: nft?.name || body.collectionName,
    collectionName: nft?.collectionName || body.collectionName,
    collectionSlug: nft?.collectionSlug || body.collectionSlug,
    amount: first.amount,
    currency: first.currency,
    issuer: first.issuer || "",
    assets,
    label: assetsLabel({ assets }),
    from: body.from || "rFuzionXioDemoBidder1111111111111",
    status: "open",
    source: body.source || "desk",
    createdAt: nowIso()
  };
  store.offers.unshift(offer);
  ensureTrustlines(store, { address: offer.from, assets });
  pushActivity(store, {
    type: kind === "collection" ? "collection_offer" : "offer",
    nftId: offer.nftId,
    name: offer.name,
    collectionName: offer.collectionName,
    collectionSlug: offer.collectionSlug,
    amount: offer.amount,
    currency: offer.currency,
    issuer: offer.issuer,
    assets,
    label: offer.label,
    from: offer.from,
    source: offer.source
  });
  return { ok: true, offer };
}

export function cancelOffer(store, offerId) {
  ensureMarket(store);
  const offer = store.offers.find((row) => row._id === offerId);
  if (!offer) return { ok: false, error: "offer not found" };
  offer.status = "cancelled";
  return { ok: true, offer };
}

export function acceptOffer(store, offerId, seller) {
  ensureMarket(store);
  const offer = store.offers.find((row) => row._id === offerId && row.status === "open");
  if (!offer) return { ok: false, error: "offer not found" };
  offer.status = "accepted";
  const fees = recordFees(store, {
    assets: offer.assets || offerAssets(offer),
    from: offer.from,
    to: seller,
    nftId: offer.nftId,
    type: "accept_offer"
  });
  if (offer.kind === "item" && offer.nftId) {
    const nft = resolveNft(store, offer.nftId);
    if (nft && nft.status === "sale") {
      buyNow(store, { nftId: offer.nftId, buyer: offer.from, skipFee: true });
    }
  }
  pushActivity(store, {
    type: "accept_offer",
    nftId: offer.nftId,
    name: offer.name,
    collectionName: offer.collectionName,
    amount: offer.amount,
    currency: offer.currency,
    from: seller,
    to: offer.from
  });
  return { ok: true, offer, simulated: true, fees };
}

export function startAuction(store, body) {
  ensureMarket(store);
  const nft = resolveNft(store, body.nftId);
  if (!nft) return { ok: false, error: "NFT not found" };
  const hours = Number(body.hours || 24);
  const auction = {
    _id: id("auc"),
    nftId: nft._id,
    name: nft.name,
    collectionName: nft.collectionName,
    minBid: String(body.minBid || nft.amount),
    reserve: String(body.reserve || body.minBid || nft.amount),
    currency: body.currency || nft.currency,
    seller: body.seller || nft.accountNumber,
    endsAt: new Date(Date.now() + hours * 3600 * 1000).toISOString(),
    bids: [],
    status: "live",
    createdAt: nowIso()
  };
  store.auctions.unshift(auction);
  pushActivity(store, {
    type: "auction",
    nftId: nft._id,
    name: nft.name,
    amount: auction.minBid,
    currency: auction.currency,
    from: auction.seller
  });
  return { ok: true, auction };
}

export function bidAuction(store, { auctionId, from, amount }) {
  ensureMarket(store);
  const auction = store.auctions.find((row) => row._id === auctionId && row.status === "live");
  if (!auction) return { ok: false, error: "auction not found" };
  if (new Date(auction.endsAt) < new Date()) {
    auction.status = "ended";
    return { ok: false, error: "auction ended" };
  }
  const high = auction.bids[0] ? Number(auction.bids[0].amount) : Number(auction.minBid);
  if (Number(amount) <= high) return { ok: false, error: "bid too low" };
  const bid = { _id: id("bid"), from, amount: String(amount), createdAt: nowIso() };
  auction.bids.unshift(bid);
  store.bids.unshift({ ...bid, auctionId, nftId: auction.nftId });
  pushActivity(store, {
    type: "bid",
    nftId: auction.nftId,
    name: auction.name,
    amount: bid.amount,
    currency: auction.currency,
    from
  });
  return { ok: true, auction, bid };
}

export function runSweep(store, name, body) {
  const plan = sweepPlan(store, name, body);
  if (!plan.ok) return plan;
  const fills = [];
  for (const item of plan.items) {
    const result = buyNow(store, { nftId: item._id, buyer: body.buyer });
    if (result.ok) fills.push(item);
  }
  pushActivity(store, {
    type: "sweep",
    collectionName: plan.collection,
    amount: plan.total,
    currency: plan.currency,
    from: body.buyer,
    count: fills.length
  });
  return { ok: true, simulated: true, ...plan, filled: fills.length };
}

export function searchMarket(store, q) {
  const query = String(q || "").trim().toLowerCase();
  if (!query) return { nfts: [], collections: [] };
  const nfts = (store.nfts || [])
    .filter((nft) =>
      [nft.name, nft.category, nft.collectionName, nft.currency]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    )
    .slice(0, 24);
  const collections = templates(store).filter((template) =>
    template.collectionName.toLowerCase().includes(query)
  );
  const virtualHits = [];
  for (const template of templates(store)) {
    const named = query.match(/#(\d+)/);
    if (named) {
      const index = Number(named[1]);
      if (index >= 1 && index <= template.size) {
        virtualHits.push(materialize(template, index, store));
      }
    }
  }
  return { nfts: [...virtualHits, ...nfts], collections };
}

export function rankings(store) {
  const collections = exploreCollections(store).sort(
    (a, b) => Number(b.volume || 0) - Number(a.volume || 0)
  );
  const traders = {};
  for (const row of store.activity || []) {
    if (row.type !== "sale") continue;
    const key = row.to || row.from;
    if (!key) continue;
    traders[key] = traders[key] || { address: key, volume: 0, sales: 0 };
    traders[key].volume += Number(row.amount || 0);
    traders[key].sales += 1;
  }
  return {
    collections,
    traders: Object.values(traders).sort((a, b) => b.volume - a.volume)
  };
}

export function activityFeed(store, query = {}) {
  let rows = store.activity || [];
  if (query.type) rows = rows.filter((row) => row.type === query.type);
  if (query.collection) {
    const slug = String(query.collection).toLowerCase();
    rows = rows.filter(
      (row) =>
        String(row.collectionSlug || "").toLowerCase() === slug ||
        String(row.collectionName || "").toLowerCase() === slug
    );
  }
  if (query.nftId) rows = rows.filter((row) => row.nftId === query.nftId);
  const page = Number(query.page || 1);
  const size = Number(query.size || 25);
  const start = (page - 1) * size;
  return pageShape(rows.slice(start, start + size), page, size, rows.length);
}

export function toggleWatch(store, { nftId, address }) {
  ensureMarket(store);
  const key = `${address}:${nftId}`;
  const existing = store.watchlist.find((row) => row.key === key);
  if (existing) {
    store.watchlist = store.watchlist.filter((row) => row.key !== key);
    return { ok: true, watching: false };
  }
  store.watchlist.push({ key, nftId, address, createdAt: nowIso() });
  return { ok: true, watching: true };
}

export function openOffers(store, query = {}) {
  return (store.offers || []).filter((row) => {
    if (row.status !== "open") return false;
    if (query.nftId && row.nftId !== query.nftId) return false;
    if (query.collection && row.collectionSlug !== query.collection && row.collectionName !== query.collection) {
      return false;
    }
    return true;
  });
}
