import { materialize, resolveNft, templates } from "./collections.js";
import { accountNfts } from "./xrpl.js";

function looksLikeXrpl(address) {
  return typeof address === "string" && /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
}

export function pinKey(address, nftId) {
  return `pin-${address}-${nftId}`;
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
    if (
      nft.accountNumber === address ||
      nft.Issuer === address ||
      nft.issuer === address
    ) {
      rows.push({ ...nft, source: "store", found: true });
    }
  }
  for (const template of templates(store)) {
    if (template.owner === address || template.issuer === address) {
      rows.push({
        ...materialize(template, 1, store),
        source: "collection",
        found: true
      });
    }
  }
  return rows;
}

export function addPin(store, address, nft) {
  const profile = ensureProfilePins(store, address);
  profile.profileHiddenNfts = profile.profileHiddenNfts.filter(
    (id) => id !== nft._id && id !== nft.NFTokenID
  );
  if (!profile.profileNfts.some((pin) => pin.nftId === nft._id)) {
    profile.profileNfts.push({
      _id: pinKey(address, nft._id),
      nftId: nft._id,
      NFTokenID: nft.NFTokenID || "",
      name: nft.name,
      addedAt: new Date().toISOString()
    });
  }
  return profile;
}

export function removePin(store, address, nftId) {
  const profile = ensureProfilePins(store, address);
  const pin = profile.profileNfts.find(
    (row) => row.nftId === nftId || row.NFTokenID === nftId || row._id === nftId
  );
  const hideId = pin?.nftId || nftId;
  profile.profileNfts = profile.profileNfts.filter(
    (row) => row.nftId !== nftId && row.NFTokenID !== nftId && row._id !== nftId
  );
  if (hideId && !profile.profileHiddenNfts.includes(hideId)) {
    profile.profileHiddenNfts.push(hideId);
  }
  return profile;
}

export function pinsForNft(store, nftId) {
  const nft = resolveNft(store, nftId);
  const ids = new Set([nftId, nft?._id, nft?.NFTokenID].filter(Boolean));
  const out = [];
  for (const profile of store.profiles || []) {
    const hidden = (profile.profileHiddenNfts || []).some((id) => ids.has(id));
    const pin = (profile.profileNfts || []).find((row) => ids.has(row.nftId) || ids.has(row.NFTokenID));
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

function card(nft, extra = {}) {
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
    amount: nft.amount,
    currency: nft.currency,
    status: nft.status,
    ...extra
  };
}

export async function profileNftDesk(store, address) {
  const profile =
    (store.profiles || []).find((row) => row.wAddress === address) || {
      profileNfts: [],
      profileHiddenNfts: []
    };
  const hidden = new Set(profile.profileHiddenNfts || []);
  const found = storeNftsForAddress(store, address).map((nft) =>
    card(nft, { source: nft.source || "store", found: true })
  );
  const pinned = [];
  for (const pin of profile.profileNfts || []) {
    const nft = resolveNft(store, pin.nftId) || resolveNft(store, pin.NFTokenID);
    pinned.push(
      card(nft || { _id: pin.nftId, name: pin.name, NFTokenID: pin.NFTokenID }, {
        source: "pinned",
        pinned: true
      })
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
    const key = row.NFTokenID || row._id;
    if (!key || hidden.has(row._id) || hidden.has(row.NFTokenID) || hidden.has(key)) {
      continue;
    }
    map.set(key, { ...map.get(key), ...row, onProfile: true });
  }
  return {
    docs: [...map.values()],
    pinned: profile.profileNfts || [],
    hidden: profile.profileHiddenNfts || [],
    count: map.size
  };
}
