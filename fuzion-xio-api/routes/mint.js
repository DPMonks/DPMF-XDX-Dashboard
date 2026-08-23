import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { update } from "../lib/store.js";
import { describeAsset } from "../lib/filetypes.js";

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

router.post("/nft/createNft", (req, res) => {
  const body = req.body || {};
  const items = asItems(body);
  if (!items.length) {
    return res.status(400).json({ success: false, message: "image/file required" });
  }
  const Ids = [];
  update((current) => {
    current.nfts = current.nfts || [];
    for (const item of items) {
      const id = `mint-${Date.now()}-${Ids.length + 1}`;
      Ids.push(id);
      current.nfts.push({
        _id: id,
        name: item.name || body.name,
        collectionName: body.collectionName || null,
        category: body.category || "Digital Art",
        description: body.description || "",
        image: item.url,
        metaverse: body.metaverse || null,
        externalurl: body.externalurl || "",
        currency: body.price?.currency || body.currency || "XRP",
        amount: String(body.price?.amount || body.amount || body.price || "0"),
        issuer: body.issuer || body.accountNumber,
        Issuer: body.issuer || body.accountNumber,
        accountNumber: body.accountNumber || body.issuer,
        fileType: item.ctype || item.ftype,
        contentType: item.ctype || item.ftype,
        status: body.status || "created",
        likes: 0,
        royaltyBps: 500,
        platformFeeBps: 0,
        createdAt: new Date().toISOString()
      });
    }
    return current;
  });
  res.json({
    success: true,
    message: `Created ${Ids.length} NFT${Ids.length > 1 ? "s" : ""}`,
    Ids
  });
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
