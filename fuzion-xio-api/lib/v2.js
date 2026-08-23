import { createHash } from "node:crypto";
import {
  findTemplate,
  materialize,
  resolveNft,
  templates
} from "./collections.js";
import { feePolicy, PLATFORM_FEE_BPS, splitTrade } from "./fees.js";
import {
  collectionStats,
  exploreCollections,
  listForSale,
  listedItems,
  openOffers,
  placeOffer,
  searchMarket
} from "./market.js";

export const NETWORK_NOTE =
  "XRPL network cost is reserve + transaction drops, paid in XRP. It is not a platform fee.";

export function fileHash(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function similar(a, b) {
  const left = String(a || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const right = String(b || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.8;
  const set = new Set(left);
  let hit = 0;
  for (const ch of right) if (set.has(ch)) hit += 1;
  return hit / Math.max(left.length, right.length);
}

export function verifiedSet(store) {
  return new Set(
    (store.verifications || [])
      .filter((row) => row.status === "verified")
      .map((row) => row.slug)
  );
}

export function collectionVerification(store, template) {
  const slug = template.slug;
  const row = (store.verifications || []).find((item) => item.slug === slug);
  const verified = row?.status === "verified" || template.verified === true;
  const mimics = (store.verifications || [])
    .filter((item) => item.status === "verified" && item.slug !== slug)
    .map((item) => ({
      slug: item.slug,
      score: similar(template.collectionName, item.name || item.slug)
    }))
    .filter((item) => item.score >= 0.72);
  return {
    slug,
    verified,
    status: verified ? "verified" : mimics.length ? "suspicious" : row?.status || "unverified",
    checks: {
      issuerPresent: Boolean(template.issuer),
      description: Boolean(template.description),
      size: Number(template.size) > 0,
      manual: verified
    },
    warning: mimics.length
      ? `Name is close to verified collection ${mimics[0].slug}`
      : verified
      ? ""
      : "Unverified collection. Review issuer and metadata before trading."
  };
}

export function rarityTable(store, template) {
  const sample = Math.min(template.size, 400);
  const counts = {};
  for (let index = 1; index <= sample; index += 1) {
    const nft = materialize(template, index, store);
    for (const trait of nft.traits || []) {
      if (trait.trait_type === "Collection") continue;
      const key = `${trait.trait_type}:${trait.value}`;
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return { sample, counts };
}

export function rarityForNft(store, nft) {
  const template = findTemplate(store, nft.collectionSlug || nft.collectionName);
  if (!template) return { rank: null, score: null, traits: [] };
  const table = rarityTable(store, template);
  const traits = (nft.traits || [])
    .filter((trait) => trait.trait_type !== "Collection")
    .map((trait) => {
      const count = table.counts[`${trait.trait_type}:${trait.value}`] || 1;
      return {
        ...trait,
        count,
        rarity: +(count / table.sample).toFixed(4)
      };
    });
  const score = traits.length
    ? traits.reduce((sum, trait) => sum + (1 - trait.rarity), 0) / traits.length
    : 0;
  const rank = Math.max(1, Math.round((1 - score) * template.size));
  return { rank, score: +score.toFixed(4), supply: template.size, traits };
}

export function floorHistory(store, template, range = "7d") {
  const stats = collectionStats(store, template);
  const days = range === "24h" ? 1 : range === "30d" ? 30 : 7;
  const points = [];
  const base = Number(stats.floor) || Number(template.amount) || 1;
  for (let i = days; i >= 0; i -= 1) {
    const at = new Date(Date.now() - i * 86400000);
    const wobble = 1 + Math.sin(i * 1.7) * 0.04;
    points.push({
      at: at.toISOString(),
      floor: +(base * wobble).toFixed(4),
      currency: stats.currency || template.currency
    });
  }
  return { range, currency: stats.currency || template.currency, current: stats.floor, points };
}

export function collectionAnalytics(store, template) {
  const stats = collectionStats(store, template);
  const sales = (store.activity || []).filter(
    (row) =>
      row.type === "sale" &&
      (row.collectionSlug === template.slug || row.collectionName === template.collectionName)
  );
  const holders = {};
  for (const nft of store.nfts || []) {
    if (nft.collectionName !== template.collectionName) continue;
    holders[nft.accountNumber] = (holders[nft.accountNumber] || 0) + 1;
  }
  holders[template.owner] = (holders[template.owner] || 0) + Math.max(1, Math.floor(template.size / 20));
  const topHolders = Object.entries(holders)
    .map(([address, count]) => ({ address, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const whales = topHolders.filter((row) => row.count >= 3);
  const floorsByCurrency = {};
  for (const nft of listedItems(store, template)) {
    const currency = nft.currency || "XRP";
    const price = Number(nft.amount) || 0;
    if (price > 0 && (floorsByCurrency[currency] == null || price < floorsByCurrency[currency])) {
      floorsByCurrency[currency] = price;
    }
  }
  return {
    ...stats,
    issuer: template.issuer,
    owner: template.owner,
    verification: collectionVerification(store, template),
    sales: sales.length,
    holders: Object.keys(holders).length,
    topHolders,
    whales,
    floorsByCurrency,
    floorHistory: floorHistory(store, template, "7d"),
    bidDepth: bidDepth(store, template.slug)
  };
}

export function bidDepth(store, slug) {
  const offers = openOffers(store, { collection: slug });
  const bids = offers
    .map((row) => ({
      id: row._id,
      kind: row.kind,
      amount: Number(row.amount) || 0,
      currency: row.currency,
      from: row.from,
      label: row.label
    }))
    .sort((a, b) => b.amount - a.amount);
  return {
    count: bids.length,
    best: bids[0] || null,
    bids: bids.slice(0, 12)
  };
}

export function discover(store, query = {}) {
  const chain = query.chain || "xrpl";
  const base = searchMarket(store, query.q || "");
  const min = query.minPrice != null ? Number(query.minPrice) : null;
  const max = query.maxPrice != null ? Number(query.maxPrice) : null;
  let nfts = [...(base.nfts || []), ...(store.nfts || [])];
  const seen = new Set();
  nfts = nfts.filter((nft) => {
    if (seen.has(nft._id)) return false;
    seen.add(nft._id);
    if (query.collection && String(nft.collectionName || "").toLowerCase() !== String(query.collection).toLowerCase()) {
      return false;
    }
    if (query.creator && nft.accountNumber !== query.creator && nft.issuer !== query.creator && nft.Issuer !== query.creator) {
      return false;
    }
    if (query.currency && String(nft.currency || "").toUpperCase() !== String(query.currency).toUpperCase()) {
      return false;
    }
    if (query.saleType && nft.status !== query.saleType) return false;
    if (query.trait) {
      const [traitType, ...rest] = String(query.trait).split(":");
      const traitValue = rest.join(":");
      if (
        traitType &&
        traitValue &&
        !(nft.traits || []).some(
          (trait) => trait.trait_type === traitType && String(trait.value) === traitValue
        )
      ) {
        return false;
      }
    }
    const price = Number(nft.amount) || 0;
    if (min != null && price < min) return false;
    if (max != null && price > max) return false;
    return true;
  });
  const creators = (store.profiles || []).filter((row) => {
    if (!query.q) return false;
    const q = String(query.q).toLowerCase();
    return [row.pName, row.wAddress, row.tagline].some((value) =>
      String(value || "").toLowerCase().includes(q)
    );
  });
  return {
    chain,
    filters: {
      chain: ["xrpl"],
      saleType: ["sale", "minted", "created", "auction"],
      architected: ["eth", "sol"]
    },
    nfts: nfts.slice(0, 48),
    collections: (base.collections || []).map((template) => ({
      ...template,
      verification: collectionVerification(store, template)
    })),
    creators,
    assets: (store.knownAssets || []).slice(0, 24)
  };
}

export function homeRails(store) {
  const collections = exploreCollections(store).map((row) => {
    const template = findTemplate(store, row.slug);
    return {
      ...row,
      verification: template ? collectionVerification(store, template) : { verified: false }
    };
  });
  const trending = [...collections].sort((a, b) => Number(b.volume || 0) - Number(a.volume || 0));
  const volume7d = trending;
  const picks = (store.editorPicks || [])
    .map((id) => resolveNft(store, id))
    .filter(Boolean);
  const drops = store.drops || [];
  return {
    trending,
    topVolume24h: trending,
    topVolume7d: volume7d,
    newDrops: drops,
    editorPicks: picks.length ? picks : (store.nfts || []).slice(0, 4)
  };
}

export function portfolio(store, address) {
  const owned = (store.nfts || []).filter(
    (nft) => nft.accountNumber === address || nft.issuer === address || nft.Issuer === address
  );
  const value = owned.reduce((sum, nft) => sum + (Number(nft.amount) || 0), 0);
  const byCollection = {};
  for (const nft of owned) {
    const key = nft.collectionName || "Uncollected";
    byCollection[key] = byCollection[key] || { collection: key, count: 0, value: 0 };
    byCollection[key].count += 1;
    byCollection[key].value += Number(nft.amount) || 0;
  }
  const sales = (store.activity || []).filter(
    (row) => row.from === address || row.to === address
  );
  const gained = sales
    .filter((row) => row.type === "sale" && row.to === address)
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const sold = sales
    .filter((row) => row.type === "sale" && row.from === address)
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  return {
    address,
    count: owned.length,
    value: +value.toFixed(4),
    pnl: +(sold - gained).toFixed(4),
    collections: Object.values(byCollection),
    activity: sales.slice(0, 20),
    nfts: owned.slice(0, 48)
  };
}

export function creatorRoyalties(store, address) {
  const rows = (store.activity || []).filter(
    (row) => row.type === "sale" && (row.from === address || row.to === address)
  );
  const earned = rows.map((row) => {
    const bps = row.royaltyBps || 500;
    const amount = Number(row.amount) || 0;
    return {
      nftId: row.nftId,
      collectionName: row.collectionName,
      currency: row.currency,
      sale: amount,
      royalty: +((amount * bps) / 10000).toFixed(6),
      at: row.createdAt
    };
  });
  const total = earned.reduce((sum, row) => sum + row.royalty, 0);
  const byCollection = {};
  for (const row of earned) {
    const key = row.collectionName || "Uncollected";
    byCollection[key] = byCollection[key] || { collection: key, royalty: 0, sales: 0 };
    byCollection[key].royalty += row.royalty;
    byCollection[key].sales += 1;
  }
  const now = Date.now();
  const inWindow = (ms) =>
    +earned
      .filter((row) => new Date(row.at || 0).getTime() >= now - ms)
      .reduce((sum, row) => sum + row.royalty, 0)
      .toFixed(6);
  return {
    address,
    total: +total.toFixed(6),
    periods: { d24h: inWindow(86400000), d7d: inWindow(7 * 86400000), d30d: inWindow(30 * 86400000) },
    byCollection: Object.values(byCollection),
    rows: earned
  };
}

export function tradeBreakdown(nft) {
  const fee = splitTrade(nft?.amount);
  const royaltyBps = Number(nft?.royaltyBps) || 500;
  const royalty = +((fee.gross * royaltyBps) / 10000).toFixed(8);
  return {
    amount: fee.gross,
    currency: nft?.currency || "XRP",
    marketplace: { bps: PLATFORM_FEE_BPS, amount: fee.fee, label: feePolicy().label },
    royalty: {
      bps: royaltyBps,
      amount: royalty,
      recipient: nft?.royaltyRecipient || nft?.issuer || nft?.Issuer || ""
    },
    network: { asset: "XRP", note: NETWORK_NOTE },
    sellerNet: +(fee.gross - fee.fee - royalty).toFixed(8)
  };
}

export function traderView(store, slug) {
  const template = findTemplate(store, slug) || templates(store)[0];
  if (!template) return { ok: false, error: "collection not found" };
  const analytics = collectionAnalytics(store, template);
  const listed = [];
  for (let index = 1; index <= Math.min(template.size, 24); index += 1) {
    const nft = materialize(template, index, store);
    if (nft.status === "sale") listed.push({ ...nft, rarity: rarityForNft(store, nft) });
  }
  listed.sort((a, b) => Number(a.amount) - Number(b.amount));
  return {
    ok: true,
    view: "pro",
    collection: template.collectionName,
    slug: template.slug,
    liveFloor: analytics.floor,
    currency: analytics.currency,
    depth: analytics.bidDepth,
    recentSales: (store.activity || []).filter((row) => row.type === "sale").slice(0, 12),
    listings: listed.slice(0, 16),
    bids: analytics.bidDepth.bids,
    verification: analytics.verification
  };
}

export function batchList(store, { ids = [], amount, currency, seller }) {
  const results = [];
  for (const nftId of ids) {
    results.push(listForSale(store, { nftId, amount, currency, seller }));
  }
  return { ok: results.every((row) => row.ok), count: results.filter((row) => row.ok).length, results };
}

export function follow(store, { from, target, kind = "creator" }) {
  store.follows = store.follows || [];
  const key = `${from}:${kind}:${target}`;
  const existing = store.follows.find((row) => row.key === key);
  if (existing) {
    store.follows = store.follows.filter((row) => row.key !== key);
    return { ok: true, following: false };
  }
  store.follows.unshift({ key, from, target, kind, createdAt: new Date().toISOString() });
  return { ok: true, following: true };
}

export function addComment(store, { nftId, from, text }) {
  store.comments = store.comments || [];
  if (!text || !nftId) return { ok: false, error: "nftId and text required" };
  const row = {
    _id: `cmt-${Date.now()}`,
    nftId,
    from,
    text: String(text).slice(0, 500),
    createdAt: new Date().toISOString()
  };
  store.comments.unshift(row);
  return { ok: true, comment: row };
}

export function commentsFor(store, nftId) {
  return (store.comments || []).filter((row) => row.nftId === nftId);
}

export function fileIntegrity(store, nft) {
  const hash = nft.fileHash || fileHash(nft.image || nft.metaverse || nft._id);
  const stored = (store.fileHashes || []).find((row) => row.nftId === nft._id);
  const match = !stored || stored.hash === hash;
  return { hash, match, badge: match ? "Verified file" : "Hash mismatch" };
}

export function reportItem(store, body) {
  store.reports = store.reports || [];
  const row = {
    _id: `rpt-${Date.now()}`,
    targetType: body.targetType || "nft",
    targetId: body.targetId,
    reason: body.reason || "abuse",
    from: body.from || "",
    status: "open",
    createdAt: new Date().toISOString()
  };
  store.reports.unshift(row);
  return { ok: true, report: row };
}

export function addDrop(store, body) {
  store.drops = store.drops || [];
  const row = {
    _id: `drop-${Date.now()}`,
    slug: body.slug || String(body.name || "drop").toLowerCase().replace(/\s+/g, "-"),
    name: body.name,
    collectionName: body.collectionName,
    description: body.description || "",
    startsAt: body.startsAt,
    endsAt: body.endsAt,
    price: body.price || "0",
    currency: body.currency || "XRP",
    allowlist: body.allowlist || [],
    preMintStartsAt: body.preMintStartsAt || body.startsAt,
    publicStartsAt: body.publicStartsAt || body.startsAt,
    status: body.status || "scheduled",
    createdAt: new Date().toISOString()
  };
  store.drops.unshift(row);
  return { ok: true, drop: row };
}

export function allowlistOk(store, { collectionName, address, at = Date.now() }) {
  const drop = (store.drops || []).find(
    (row) => row.collectionName === collectionName || row.slug === collectionName
  );
  if (!drop || !(drop.allowlist || []).length) return { ok: true, enforced: false };
  const now = new Date(at).getTime();
  const pre = drop.preMintStartsAt ? new Date(drop.preMintStartsAt).getTime() : 0;
  const pub = drop.publicStartsAt ? new Date(drop.publicStartsAt).getTime() : 0;
  if (pub && now >= pub) return { ok: true, enforced: false, window: "public" };
  if (pre && now >= pre && !(drop.allowlist || []).includes(address)) {
    return { ok: false, enforced: true, error: "Address is not on the allowlist for this pre-mint window" };
  }
  return { ok: true, enforced: true, window: "allowlist" };
}

export function addLaunch(store, body) {
  store.launches = store.launches || [];
  const row = {
    _id: `launch-${Date.now()}`,
    name: body.name,
    description: body.description || "",
    banner: body.banner || "",
    image: body.image || "",
    schedule: body.schedule || "",
    creator: body.creator || "",
    status: "review",
    createdAt: new Date().toISOString()
  };
  store.launches.unshift(row);
  return { ok: true, launch: row };
}

export function addProposal(store, body) {
  store.proposals = store.proposals || [];
  const row = {
    _id: `gov-${Date.now()}`,
    title: body.title,
    kind: body.kind || "feature",
    body: body.body || "",
    status: "open",
    yes: 0,
    no: 0,
    createdAt: new Date().toISOString()
  };
  store.proposals.unshift(row);
  return { ok: true, proposal: row };
}

export function voteProposal(store, { proposalId, address, support, weight }) {
  store.votes = store.votes || [];
  const proposal = (store.proposals || []).find((row) => row._id === proposalId);
  if (!proposal || proposal.status !== "open") return { ok: false, error: "proposal not open" };
  const key = `${proposalId}:${address}`;
  if (store.votes.some((row) => row.key === key)) return { ok: false, error: "already voted" };
  const power = Number(weight) || 1;
  store.votes.push({ key, proposalId, address, support: Boolean(support), weight: power });
  if (support) proposal.yes += power;
  else proposal.no += power;
  return { ok: true, proposal };
}

export function ingestExternal(store, listing) {
  store.aggregator = store.aggregator || { sources: [], listings: [] };
  const row = {
    _id: `agg-${Date.now()}`,
    source: listing.source || "external",
    nftId: listing.nftId,
    name: listing.name,
    amount: listing.amount,
    currency: listing.currency,
    chain: "xrpl",
    createdAt: new Date().toISOString()
  };
  store.aggregator.listings.unshift(row);
  return { ok: true, listing: row, note: "Ingested for later XRPL marketplace aggregation." };
}

export function feeQuote(nft) {
  return {
    ...tradeBreakdown(nft),
    policy: feePolicy()
  };
}
