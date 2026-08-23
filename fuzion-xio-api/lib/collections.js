import { THREE_D_TYPES } from "./constants.js";

export function templates(store) {
  return store.collectionTemplates || [];
}

export function findTemplate(store, nameOrSlug) {
  const q = String(nameOrSlug || "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ");
  return templates(store).find((item) => {
    const slug = String(item.slug || "").toLowerCase().replace(/[-_]+/g, " ");
    const name = String(item.collectionName || "").toLowerCase();
    return slug === q || name === q || name.startsWith(q) || q.startsWith(name);
  });
}

export function virtualId(slug, index) {
  return `col:${slug}:${index}`;
}

export function parseVirtualId(id) {
  const match = String(id || "").match(/^col:([^:]+):(\d+)$/);
  if (!match) return null;
  return { slug: match[1], index: Number(match[2]) };
}

export function itemStatus(index) {
  const slot = index % 5;
  if (slot === 0) return "created";
  if (slot === 1) return "minted";
  return "sale";
}

export function is3dType(fileType) {
  return THREE_D_TYPES.includes(String(fileType || "").toLowerCase());
}

export function materialize(template, index) {
  const status = itemStatus(index);
  const padded = String(index).padStart(4, "0");
  const slugKey = String(template.slug || "col")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  return {
    _id: virtualId(template.slug, index),
    name: `${template.collectionName} #${index}`,
    collectionName: template.collectionName,
    collectionSlug: template.slug,
    category: template.category,
    description: `${template.description} Edition ${index} of ${template.size}.`,
    image: template.metaverse || template.image,
    previewImage: template.image,
    metaDataUrl: template.metaDataUrl || null,
    metaverse: template.metaverse,
    usdzUrl: template.usdzUrl || null,
    currency: template.currency,
    amount: template.amount,
    issuer: template.issuer,
    Issuer: template.issuer,
    IssuerAddr: template.issuer,
    accountNumber: template.owner,
    NFTokenID: `00080000FUZION${slugKey}${padded}`,
    fileType: template.fileType,
    contentType: template.contentType || template.fileType,
    status,
    likes: (index * 7) % 23,
    isPurchased: status === "created" ? 0 : 1,
    isMinted: status !== "created",
    traits: [
      { trait_type: "Collection", value: template.collectionName },
      { trait_type: "Edition", value: String(index) },
      { trait_type: "Supply", value: String(template.size) },
      { trait_type: "File", value: template.fileType },
      { trait_type: "Program", value: template.program || "XD-1" },
      { trait_type: "Dimension", value: is3dType(template.fileType) ? "3D" : "2D" }
    ],
    createdAt: template.createdAt,
    virtual: true,
    collectionSize: template.size,
    program: template.program || "XD-1"
  };
}

export function paginate(template, { page = 1, size = 12, filter = "all" } = {}) {
  const indexes = [];
  for (let i = 1; i <= template.size; i += 1) {
    if (filter === "all" || itemStatus(i) === filter) indexes.push(i);
  }
  const total = indexes.length;
  const totalPages = Math.max(1, Math.ceil(total / size) || 1);
  const current = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const docs = indexes
    .slice((current - 1) * size, current * size)
    .map((index) => materialize(template, index));
  return {
    docs,
    page: current,
    size,
    total,
    length: total,
    totalPages,
    hasPrevPage: current > 1,
    hasNextPage: current < totalPages,
    prevPage: current > 1 ? current - 1 : null,
    nextPage: current < totalPages ? current + 1 : null,
    collectionName: template.collectionName,
    slug: template.slug,
    fileType: template.fileType
  };
}

export function featuredFromTemplates(store, perCollection = 1) {
  return templates(store).flatMap((template) =>
    Array.from({ length: perCollection }, (_, offset) =>
      materialize(template, offset + 1)
    )
  );
}

export function templateCards(store) {
  return templates(store).map((template) => ({
    ...materialize(template, 1),
    _id: `tpl:${template.slug}`,
    isPurchased: 0,
    contentType: template.contentType || template.fileType,
    collection: template.collectionName,
    size: template.size
  }));
}

export function resolveNft(store, id) {
  if (!id) return null;
  const parsed = parseVirtualId(id);
  if (parsed) {
    const template = findTemplate(store, parsed.slug);
    if (template && parsed.index >= 1 && parsed.index <= template.size) {
      return materialize(template, parsed.index);
    }
  }

  const direct = (store.nfts || []).find(
    (nft) => nft._id === id || nft.NFTokenID === id || nft.name === id
  );
  if (direct) return direct;

  const named = String(id).match(/^(.*)\s*#(\d+)$/);
  if (named) {
    const template = findTemplate(store, named[1].trim());
    if (template) {
      const index = Number(named[2]);
      if (index >= 1 && index <= template.size) return materialize(template, index);
    }
  }

  return null;
}

export function collectionCount(store, name) {
  const template = findTemplate(store, name);
  if (template) return template.size;
  const prefix = String(name || "").trim().toLowerCase();
  return (store.nfts || []).filter((nft) =>
    String(nft.name || "").toLowerCase().startsWith(prefix)
  ).length;
}

export function pageShape(docs, page, size, total) {
  const totalPages = Math.max(1, Math.ceil(total / size) || 1);
  const current = Math.min(Math.max(1, Number(page) || 1), totalPages);
  return {
    docs,
    page: current,
    size,
    total,
    length: total,
    totalPages,
    hasPrevPage: current > 1,
    hasNextPage: current < totalPages,
    prevPage: current > 1 ? current - 1 : null,
    nextPage: current < totalPages ? current + 1 : null
  };
}
