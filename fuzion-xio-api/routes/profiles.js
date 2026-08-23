import { Router } from "express";
import { readStore, update } from "../lib/store.js";
import {
  enrichAddress,
  findProfile,
  listProfiles
} from "../lib/profile.js";
import {
  fallbackCardSvg,
  isSocialCrawler,
  profileImageSrc,
  publicOrigin,
  readStoredImage,
  shareHtml
} from "../lib/opengraph.js";
import { storedUploadPath, upload } from "../lib/upload.js";

const router = Router();

const uploadProfile = upload.fields([
  { name: "pImage", maxCount: 1 },
  { name: "pBanner", maxCount: 1 },
  { name: "dBanner", maxCount: 1 }
]);

function applyUploads(body, files = {}) {
  const next = { ...body };
  if (files.pImage?.[0]) next.pImage = storedUploadPath(files.pImage[0]);
  if (files.pBanner?.[0]) next.pBanner = storedUploadPath(files.pBanner[0]);
  if (files.dBanner?.[0]) next.dBanner = storedUploadPath(files.dBanner[0]);
  return next;
}

function saveProfile(req, res) {
  const body = applyUploads(req.body || {}, req.files || {});
  if (!body.wAddress) {
    return res.status(400).json({ success: false, message: "wAddress required" });
  }
  const store = update((current) => {
    const existing = current.profiles.find((profile) => profile.wAddress === body.wAddress);
    const row = {
      pName: body.pName,
      bio: body.bio,
      tagline: body.tagline,
      location: body.location,
      website: body.website,
      socialLinks: body.socialLinks,
      fourthCurrency: body.fourthCurrency,
      pImage: body.pImage,
      pBanner: body.pBanner,
      dBanner: body.dBanner,
      isActive: true,
      isEdited: true,
      updatedAt: new Date().toISOString()
    };
    Object.keys(row).forEach((key) => {
      if (row[key] === undefined) delete row[key];
    });
    if (existing) {
      Object.assign(existing, row);
    } else {
      current.profiles.push({
        _id: `profile-${body.wAddress}`,
        wAddress: body.wAddress,
        createdAt: new Date().toISOString(),
        vPoint: 0,
        ...row
      });
    }
    return current;
  });
  res.json({
    success: true,
    message: "Profile saved",
    data: store.profiles.find((profile) => profile.wAddress === body.wAddress)
  });
}

router.get("/profiles", (_req, res) => {
  const store = readStore();
  res.json({ success: true, data: listProfiles(store), count: store.profiles.length });
});

router.get("/profile/:address", async (req, res) => {
  const store = readStore();
  const address = req.params.address;
  res.json({
    success: true,
    data: findProfile(store, address) || { wAddress: address },
    governance: await enrichAddress(store, address)
  });
});

router.post("/profile/createprofile", (req, res, next) => {
  const type = String(req.headers["content-type"] || "");
  if (type.includes("multipart/form-data")) {
    return uploadProfile(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: String(err.message || err) });
      return saveProfile(req, res);
    });
  }
  return saveProfile(req, res);
});

router.get("/og/profile/:address", async (req, res) => {
  const store = readStore();
  const profile = findProfile(store, req.params.address) || { wAddress: req.params.address };
  const src = profileImageSrc(profile);
  const stored = src && !/^https?:\/\//i.test(src) ? readStoredImage(src) : null;
  if (stored) {
    res.setHeader("content-type", stored.type);
    res.setHeader("cache-control", "public, max-age=300");
    return res.send(stored.buffer);
  }
  if (src && /^https?:\/\//i.test(src)) {
    try {
      const upstream = await fetch(src);
      if (upstream.ok) {
        res.setHeader(
          "content-type",
          upstream.headers.get("content-type") || "image/jpeg"
        );
        res.setHeader("cache-control", "public, max-age=300");
        return res.send(Buffer.from(await upstream.arrayBuffer()));
      }
    } catch {
      // fall through to generated card
    }
  }
  res.setHeader("content-type", "image/svg+xml");
  res.setHeader("cache-control", "public, max-age=120");
  res.send(fallbackCardSvg(profile));
});

function sendShare(req, res, refresh) {
  const store = readStore();
  const address = req.params.address;
  const profile = findProfile(store, address) || { wAddress: address };
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.send(
    shareHtml({
      origin: publicOrigin(req),
      address,
      profile,
      refresh
    })
  );
}

router.get("/share/profile/:address", (req, res) => sendShare(req, res, true));

router.get("/Profile/:address", (req, res, next) => {
  if (!isSocialCrawler(req.get("user-agent") || "") && req.query.og !== "1") {
    return next();
  }
  return sendShare(req, res, false);
});

export default router;
