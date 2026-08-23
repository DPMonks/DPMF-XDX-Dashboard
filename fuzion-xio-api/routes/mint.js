import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { readStore, update } from "../lib/store.js";
import { describeAsset } from "../lib/filetypes.js";
import {
  allowedPreparedFile,
  disseminateUploads,
  disseminateZip,
  findPack,
  isZipName,
  listPacks,
  markCreated
} from "../lib/prepared.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(root, "..", "data", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = String(file.originalname || "file")
      .replace(/[^\w.\-]+/g, "_")
      .slice(0, 80);
    cb(null, `${Date.now()}-${safe}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 80 * 1024 * 1024 } });
const uploadMany = multer({
  storage,
  limits: { fileSize: 80 * 1024 * 1024, files: 1000 }
});

const router = Router();

function publicUrl(filename) {
  return `/api/uploads/${filename}`;
}

function asItems(body) {
  const raw = body.image || body.fileType || [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((item, index) => {
      if (!item) return null;
      if (typeof item === "string") {
        const { kind, ext } = describeAsset(item, "");
        return { url: item, ftype: ext, ctype: kind, name: `${body.name || "NFT"} #${index + 1}` };
      }
      const url = item.url || item.image;
      const { kind, ext } = describeAsset(url || item.name, item.mime);
      return {
        url,
        ftype: item.ftype || ext,
        ctype: item.ctype || kind,
        name: item.name || `${body.name || "NFT"} #${index + 1}`
      };
    })
    .filter((item) => item?.url);
}

router.post("/mint/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "file required" });
  }
  const { kind, ext } = describeAsset(req.file.originalname, req.file.mimetype);
  res.json({
    success: true,
    url: publicUrl(req.file.filename),
    name: req.file.originalname,
    mime: req.file.mimetype,
    kind,
    ext
  });
});

router.post("/profile/createfbxfile", upload.single("fbxImage"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "fbxImage required" });
  }
  res.json({
    success: true,
    fbxFile: `uploads/${req.file.filename}`
  });
});

router.get("/convert-fbx", async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).json({ success: false, message: "url required" });
  try {
    const upstream = await fetch(target);
    if (!upstream.ok) return res.status(upstream.status).end();
    res.setHeader("content-type", upstream.headers.get("content-type") || "application/octet-stream");
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    res.status(502).json({ success: false, message: String(error.message || error) });
  }
});

function insertCreatedNfts(store, body, items) {
  const Ids = [];
  store.nfts = store.nfts || [];
  for (const item of items) {
    const id = `mint-${Date.now()}-${Ids.length + 1}`;
    Ids.push(id);
    store.nfts.push({
      _id: id,
      name: item.name || body.name,
      collectionName: body.collectionName || null,
      category: body.category || "Digital Art",
      description: item.description || body.description || "",
      image: item.url,
      metaverse: body.metaverse || null,
      externalurl: body.externalurl || "",
      currency: body.price?.currency || body.currency || "XRP",
      amount: String(body.price?.amount || body.amount || body.price || "0"),
      issuer: body.issuer || body.accountNumber,
      Issuer: body.issuer || body.accountNumber,
      accountNumber: body.accountNumber || body.issuer,
      fileType: item.ctype || item.kind || item.ftype,
      contentType: item.ctype || item.kind || item.ftype,
      status: body.status || "created",
      likes: 0,
      royaltyBps: 500,
      platformFeeBps: 0,
      preparedPackId: body.packId || null,
      createdAt: new Date().toISOString()
    });
  }
  return Ids;
}

router.post("/nft/createNft", (req, res) => {
  const body = req.body || {};
  const items = asItems(body);
  if (!items.length) {
    return res.status(400).json({ success: false, message: "image/file required" });
  }
  let Ids = [];
  update((current) => {
    Ids = insertCreatedNfts(current, body, items);
    return current;
  });
  res.json({
    success: true,
    message: `Created ${Ids.length} NFT${Ids.length > 1 ? "s" : ""}`,
    Ids
  });
});

router.post("/mint/prepared", uploadMany.array("files", 1000), async (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({ success: false, message: "files required" });
  }
  const rejected = files.filter((file) => !allowedPreparedFile(file.originalname, file.mimetype));
  if (rejected.length === files.length) {
    return res.status(400).json({
      success: false,
      message: "Upload a .zip pack or mintable NFT files"
    });
  }
  const zips = files.filter((file) => isZipName(file.originalname));
  const rest = files.filter((file) => !isZipName(file.originalname));
  const options = {
    packName: req.body?.name || req.body?.collectionName || "",
    account: req.body?.wAddress || req.body?.accountNumber || ""
  };
  try {
    let pack;
    if (zips.length) {
      pack = await disseminateZip(uploadDir, zips[0], rest, options);
    } else {
      pack = disseminateUploads(uploadDir, rest, options);
    }
    if (!pack.items.length) {
      return res.status(400).json({
        success: false,
        message: "No mintable NFT files found in the pack"
      });
    }
    update((current) => {
      current.preparedPacks = current.preparedPacks || [];
      current.preparedPacks.unshift(pack);
      return current;
    });
    res.json({
      success: true,
      message: `Disseminated ${pack.items.length} file${pack.items.length === 1 ? "" : "s"} ready to create`,
      data: pack
    });
  } catch (error) {
    res.status(400).json({ success: false, message: String(error.message || error) });
  }
});

router.get("/mint/prepared", (req, res) => {
  const store = readStore();
  const docs = listPacks(store, req.query.address || req.query.wAddress);
  res.json({
    success: true,
    data: { docs, count: docs.length }
  });
});

router.get("/mint/prepared/:packId", (req, res) => {
  const pack = findPack(readStore(), req.params.packId);
  if (!pack) return res.status(404).json({ success: false, message: "Prepared pack not found" });
  res.json({ success: true, data: pack });
});

router.post("/mint/prepared/:packId/create", (req, res) => {
  const body = req.body || {};
  let Ids = [];
  let packOut = null;
  update((current) => {
    const pack = findPack(current, req.params.packId);
    if (!pack) return current;
    const wanted = new Set(
      (body.itemIds || body.ids || []).filter(Boolean)
    );
    const ready = (pack.items || []).filter((item) => {
      if (item.status === "created") return false;
      if (wanted.size && !wanted.has(item._id)) return false;
      return Boolean(item.url);
    });
    if (!ready.length) return current;
    Ids = insertCreatedNfts(current, { ...body, packId: pack._id }, ready);
    const created = ready.map((item, index) => ({
      itemId: item._id,
      url: item.url,
      nftId: Ids[index]
    }));
    markCreated(pack, created);
    packOut = pack;
    return current;
  });
  if (!packOut) {
    const missing = !findPack(readStore(), req.params.packId);
    return res.status(missing ? 404 : 400).json({
      success: false,
      message: missing ? "Prepared pack not found" : "No ready files to create"
    });
  }
  res.json({
    success: true,
    message: `Created ${Ids.length} NFT${Ids.length > 1 ? "s" : ""} from prepared files`,
    Ids,
    data: packOut
  });
});

router.delete("/mint/prepared/:packId", (req, res) => {
  let removed = false;
  update((current) => {
    const before = (current.preparedPacks || []).length;
    current.preparedPacks = (current.preparedPacks || []).filter(
      (pack) => pack._id !== req.params.packId
    );
    removed = current.preparedPacks.length !== before;
    return current;
  });
  if (!removed) {
    return res.status(404).json({ success: false, message: "Prepared pack not found" });
  }
  res.json({ success: true, message: "Prepared pack removed" });
});

router.post("/mintoffer/create", (req, res) => {
  const rows = req.body?.offerData || [];
  update((current) => {
    current.mints = current.mints || [];
    for (const row of rows) {
      current.mints.push({ ...row, createdAt: new Date().toISOString() });
    }
    return current;
  });
  res.json({ success: true, message: "Mint offers stored", count: rows.length });
});

export { uploadDir };
export default router;
