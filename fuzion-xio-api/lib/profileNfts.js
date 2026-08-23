import {
  findTemplate,
  materialize,
  resolveNft,
  templates,
  virtualId
} from "./collections.js";
import { accountNfts } from "./xrpl.js";
import { nftValidation } from "./validation.js";

function looksLikeXrpl(address) {
  return typeof address === "string" && /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
}

export function pinKey(address, nftId) {
  return `pin-${address}-${nftId}`;
}

export function sameDeskIdentity(a, b) {
  if (!a || !b) return false;
  if (a.NFTokenID && b.NFTokenID && a.NFTokenID === b.NFTokenID) return true;
  if (a._id && b._id && a._id === b._id) return true;
  const ac = String(a.collectionName || "").trim().toLowerCase();
  const bc = String(b.collectionName || "").trim().toLowerCase();
  const an = String(a.name || "").trim().toLowerCase();
  const bn = String(b.name || "").trim().toLowerCase();
  return Boolean(ac && bc && ac === bc && an && an === bn);
}

export function deskKey(row) {
  const col = String(row.collectionName || "").trim().toLowerCase();
  const name = String(row.name || "").trim().toLowerCase();
  if (col && name) return `cn:${col}:${name}`;
  if (row.NFTokenID) return `tid:${row.NFTokenID}`;
  return `id:${row._id}`;
}

export function relatedNftIds(store, nftOrId) {
  const seed = typeof nftOrId === "object" && nftOrId
    ? nftOrId
    : resolveNft(store, nftOrId);
  const ids = new Set(
    [typeof nftOrId === "string" ? nftOrId : null, seed?._id, seed?.NFTokenID].filter(Boolean)
  );
  if (!seed) return [...ids];

  const named = String(seed.name || "").match(/^(.*)\s*#(\d+)$/);
  const col = seed.collectionName || seed.collectionSlug || named?.[1];
  const index = Number(seed.nftNumber || named?.[2] || 0);
  const template = findTemplate(store, col);
  if (template && index) {
    const virtual = materialize(template, index, store);
    ids.add(virtual._id);
    ids.add(virtual.NFTokenID);
    ids.add(virtualId(template.slug, index));
  }
  for (const row of store.nfts || []) {
    if (sameDeskIdentity(row, seed)) {
      ids.add(row._id);
      ids.add(row.NFTokenID);
    }
  }
  return [...ids];
}

export function ensureProfilePins(store, address) {
  store.profiles = store.profiles || [];
  let profile = store.profiles.find((row) => row.wAddress === address);
  if (!profile) {
    profile = {
      _id: `profile-${address}`,
      wAddress: address,
      profileNfts: [],
      profileHiddenNfts: [],
      createdAt: new Date().toISOString()
    };
    store.profiles.push(profile);
  }
  profile.profileNfts = profile.profileNfts || [];
  profile.profileHiddenNfts = profile.profileHiddenNfts || [];
  return profile;
}

export function storeNftsForAddress(store, address) {
  const rows = [];
  for (const nft of store.nfts || []) {
    if (nft.collectionTemplate) continue;
    if (
      nft.accountNumber === address ||
      nft.Issuer === address ||
      nft.issuer === address
    ) {
      rows.push({ ...nft, source: "store", found: true });
    }
  }
  for (const template of templates(store)) {
    if (template.owner !== address && template.issuer !== address) continue;
    const virtual = materialize(template, 1, store);
    if (rows.some((row) => sameDeskIdentity(row, virtual))) continue;
    rows.push({
      ...virtual,
      source: "collection",
      found: true
    });
  }
  return rows;
}

export function addPin(store, address, nft) {
  const profile = ensureProfilePins(store, address);
  const ids = new Set(relatedNftIds(store, nft));
  profile.profileHiddenNfts = profile.profileHiddenNfts.filter((id) => !ids.has(id));
  if (!profile.profileNfts.some((pin) => ids.has(pin.nftId) || ids.has(pin.NFTokenID))) {
    profile.profileNfts.push({
      _id: pinKey(address, nft._id),
      nftId: nft._id,
      NFTokenID: nft.NFTokenID || "",
      name: nft.name,
      collectionName: nft.collectionName || "",
      image: nft.image || nft.previewImage || "",
      previewImage: nft.previewImage || nft.image || "",
      fileType: nft.fileType || nft.contentType || "",
      contentType: nft.contentType || nft.fileType || "",
      addedAt: new Date().toISOString()
    });
  }
  return profile;
}

export function removePin(store, address, nftId) {
  const profile = ensureProfilePins(store, address);
  const nft = resolveNft(store, nftId);
  const ids = new Set(relatedNftIds(store, nft || nftId));
  ids.add(nftId);
  profile.profileNfts = profile.profileNfts.filter(
    (row) => !ids.has(row.nftId) && !ids.has(row.NFTokenID) && !ids.has(row._id)
  );
  for (const id of ids) {
    if (id && !profile.profileHiddenNfts.includes(id)) {
      profile.profileHiddenNfts.push(id);
    }
  }
  return profile;
}

export function pinsForNft(store, nftId) {
  const nft = resolveNft(store, nftId);
  const ids = new Set(relatedNftIds(store, nft || nftId));
  const out = [];
  for (const profile of store.profiles || []) {
    const hidden = (profile.profileHiddenNfts || []).some((id) => ids.has(id));
    const pin = (profile.profileNfts || []).find(
      (row) => ids.has(row.nftId) || ids.has(row.NFTokenID)
    );
    if (pin && !hidden) {
      out.push({
        _id: pin._id || pinKey(profile.wAddress, pin.nftId || nftId),
        walletAddr: profile.wAddress,
        nftId: pin.nftId,
        NFTokenID: pin.NFTokenID
      });
    }
  }
  if (nft) {
    for (const addr of [nft.accountNumber, nft.Issuer, nft.issuer].filter(Boolean)) {
      const profile = (store.profiles || []).find((row) => row.wAddress === addr);
      const hidden = (profile?.profileHiddenNfts || []).some((id) => ids.has(id));
      if (!hidden && !out.some((row) => row.walletAddr === addr)) {
        out.push({
          _id: pinKey(addr, nft._id),
          walletAddr: addr,
          nftId: nft._id,
          NFTokenID: nft.NFTokenID,
          implicit: true
        });
      }
    }
  }
  return out;
}

function card(store, nft, extra = {}) {
  const validation = nftValidation(store, nft);
  return {
    _id: nft._id,
    name: nft.name,
    collectionName: nft.collectionName,
    image: nft.image || nft.previewImage,
    previewImage: nft.previewImage || nft.image,
    metaverse: nft.metaverse,
    fileType: nft.fileType,
    contentType: nft.contentType || nft.fileType,
    NFTokenID: nft.NFTokenID,
    accountNumber: nft.accountNumber,
    issuer: nft.Issuer || nft.issuer,
    IssuerAddr: nft.IssuerAddr || nft.Issuer || nft.issuer,
    amount: nft.amount,
    currency: nft.currency,
    status: nft.status,
    isPurchased: nft.isPurchased,
    vscore: validation.vScore,
    badge: validation.badge,
    validation,
    ...extra
  };
}

function sourceRank(row) {
  if (row.source === "store") return 4;
  if (row.pinned || row.source === "pinned") return 3;
  if (row.source === "xrpl") return 2;
  return 1;
}

function mergeCard(existing, incoming) {
  if (!existing) return incoming;
  return sourceRank(incoming) >= sourceRank(existing)
    ? { ...existing, ...incoming }
    : { ...incoming, ...existing };
}

export function snapshotFromBody(body) {
  const nft = body?.nftDetail || body?.nft;
  if (!nft || typeof nft !== "object") return null;
  const id = nft._id || nft.Id || nft.NFTokenID || body.Id || body.nftId;
  if (!id) return null;
  return { ...nft, _id: id };
}

export async function profileNftDesk(store, address) {
  const profile =
    (store.profiles || []).find((row) => row.wAddress === address) || {
      profileNfts: [],
      profileHiddenNfts: []
    };
  const hidden = new Set(profile.profileHiddenNfts || []);
  const found = storeNftsForAddress(store, address).map((nft) =>
    card(store, nft, { source: nft.source || "store", found: true })
  );
  const pinned = [];
  for (const pin of profile.profileNfts || []) {
    const nft = resolveNft(store, pin.nftId) || resolveNft(store, pin.NFTokenID);
    pinned.push(
      card(
        store,
        nft || {
          _id: pin.nftId,
          name: pin.name,
          collectionName: pin.collectionName,
          image: pin.image,
          previewImage: pin.previewImage,
          fileType: pin.fileType,
          contentType: pin.contentType,
          NFTokenID: pin.NFTokenID
        },
        {
          source: "pinned",
          pinned: true
        }
      )
    );
  }
  let ledger = [];
  if (looksLikeXrpl(address)) {
    const nfts = await accountNfts(address).catch(() => ({ ok: false }));
    if (nfts.ok) {
      ledger = (nfts.result.account_nfts || []).map((row) => {
        const match =
          resolveNft(store, row.NFTokenID) ||
          (store.nfts || []).find((item) => item.NFTokenID === row.NFTokenID);
        return card(
          store,
          match || {
            _id: row.NFTokenID,
            name: `XRPL NFT ${String(row.NFTokenID).slice(0, 8)}…`,
            NFTokenID: row.NFTokenID,
            fileType: "image",
            contentType: "image"
          },
          { source: "xrpl", found: true }
        );
      });
    }
  }

  const map = new Map();
  for (const row of [...found, ...pinned, ...ledger]) {
    const key = deskKey(row);
    const related = relatedNftIds(store, row);
    if (
      !key ||
      hidden.has(row._id) ||
      hidden.has(row.NFTokenID) ||
      hidden.has(key) ||
      related.some((id) => hidden.has(id))
    ) {
      continue;
    }
    map.set(key, mergeCard(map.get(key), { ...row, onProfile: true }));
  }
  return {
    docs: [...map.values()],
    pinned: profile.profileNfts || [],
    hidden: profile.profileHiddenNfts || [],
    count: map.size
  };
}
