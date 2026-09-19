import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { describeAsset } from "./filetypes.js";

const MAX_PACK_FILES = 1000;
const SKIP_NAME = /(^|\/)(\.|__macosx)/i;

export function isZipName(name = "") {
  return /\.zip$/i.test(name);
}

export function isJsonName(name = "") {
  return /\.json$/i.test(name);
}

export function allowedPreparedFile(name = "", mime = "") {
  if (isZipName(name) || isJsonName(name)) return true;
  const { kind } = describeAsset(name, mime);
  return Boolean(kind && kind !== "file");
}

function safeBase(name) {
  return String(name || "file")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 80) || "file";
}

export function publicUploadUrl(filename) {
  return `/api/uploads/${filename}`;
}

export function writeUpload(uploadDir, originalName, buffer) {
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBase(originalName)}`;
  fs.writeFileSync(path.join(uploadDir, filename), buffer);
  return { filename, url: publicUploadUrl(filename) };
}

export function parseManifest(text) {
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object") return null;
    const items = data.items || data.nfts || data.files;
    if (!Array.isArray(items)) {
      return {
        name: data.name || data.collectionName || "",
        collectionName: data.collectionName || data.collection || "",
        description: data.description || "",
        items: []
      };
    }
    return {
      name: data.name || data.collectionName || "",
      collectionName: data.collectionName || data.collection || "",
      description: data.description || "",
      items: items.map((item, index) => {
        if (typeof item === "string") {
          return { file: item, name: "", description: "" };
        }
        return {
          file: item.file || item.filename || item.image || item.url || "",
          name: item.name || "",
          description: item.description || "",
          attributes: item.attributes || item.traits || []
        };
      }).filter((item, index) => item.file || item.name || index >= 0)
    };
  } catch {
    return null;
  }
}

function matchManifest(manifest, filename) {
  if (!manifest?.items?.length) return null;
  const base = safeBase(filename).toLowerCase();
  return manifest.items.find((item) => {
    const file = safeBase(item.file).toLowerCase();
    return file && (file === base || item.file.toLowerCase().endsWith(filename.toLowerCase()));
  });
}

export async function extractZip(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const out = [];
  const names = Object.keys(zip.files).sort();
  for (const name of names) {
    const entry = zip.files[name];
    if (!entry || entry.dir || SKIP_NAME.test(name)) continue;
    const base = name.replace(/\\/g, "/").split("/").pop();
    if (!base || SKIP_NAME.test(base)) continue;
    out.push({
      name: base,
      relative: name,
      buffer: await entry.async("nodebuffer")
    });
    if (out.length > MAX_PACK_FILES) {
      throw new Error(`Pack exceeds ${MAX_PACK_FILES} files`);
    }
  }
  return out;
}

function toItem(file, url, mime, extra = {}) {
  const { kind, ext } = describeAsset(file, mime);
  return {
    _id: extra._id,
    name: extra.name || file.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
    originalName: file,
    url,
    mime: mime || "",
    kind: extra.kind || kind,
    ext: extra.ext || ext,
    description: extra.description || "",
    attributes: extra.attributes || [],
    status: "ready",
    nftId: null
  };
}

export function disseminateUploads(uploadDir, files, { packName, account } = {}) {
  let manifest = null;
  const media = [];

  for (const file of files) {
    const name = file.originalname || file.name;
    if (isJsonName(name) && !manifest) {
      const text = file.buffer
        ? file.buffer.toString("utf8")
        : fs.readFileSync(file.path, "utf8");
      const parsed = parseManifest(text);
      if (parsed) {
        manifest = parsed;
        continue;
      }
    }
    if (isZipName(name)) continue;
    if (!allowedPreparedFile(name, file.mimetype)) continue;
    const buffer = file.buffer || fs.readFileSync(file.path);
    const stored = writeUpload(uploadDir, name, buffer);
    media.push({
      originalName: safeBase(name),
      mime: file.mimetype,
      ...stored
    });
  }

  const items = media.map((row, index) => {
    const meta = matchManifest(manifest, row.originalName);
    return toItem(row.originalName, row.url, row.mime, {
      _id: `prep-${Date.now()}-${index + 1}`,
      name: meta?.name,
      description: meta?.description,
      attributes: meta?.attributes
    });
  });

  return {
    _id: `pack-${Date.now()}`,
    name: packName || manifest?.name || files[0]?.originalname || "Prepared pack",
    collectionName: manifest?.collectionName || packName || "",
    description: manifest?.description || "",
    account: account || "",
    createdAt: new Date().toISOString(),
    status: items.length ? "ready" : "empty",
    items
  };
}

export async function disseminateZip(uploadDir, zipFile, extras = [], options = {}) {
  const buffer = zipFile.buffer || fs.readFileSync(zipFile.path);
  const extracted = await extractZip(buffer);
  const asUploads = extracted.map((entry) => ({
    originalname: entry.name,
    name: entry.name,
    mimetype: "",
    buffer: entry.buffer
  }));
  return disseminateUploads(uploadDir, [...asUploads, ...extras], {
    packName: options.packName || zipFile.originalname?.replace(/\.zip$/i, ""),
    account: options.account
  });
}

export function listPacks(store, address) {
  const rows = store.preparedPacks || [];
  if (!address) return rows;
  return rows.filter((pack) => !pack.account || pack.account === address);
}

export function findPack(store, packId) {
  return (store.preparedPacks || []).find((pack) => pack._id === packId) || null;
}

export function markCreated(pack, created) {
  const byUrl = new Map(created.map((row) => [row.url, row.nftId]));
  const byId = new Map(created.map((row) => [row.itemId, row.nftId]));
  pack.items = (pack.items || []).map((item) => {
    const nftId = byId.get(item._id) || byUrl.get(item.url);
    if (!nftId) return item;
    return { ...item, status: "created", nftId };
  });
  pack.status = pack.items.every((item) => item.status === "created")
    ? "created"
    : pack.items.some((item) => item.status === "created")
    ? "partial"
    : pack.status;
  return pack;
}
