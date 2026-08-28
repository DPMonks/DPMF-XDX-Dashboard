import { Router } from "express";
import { readStore } from "../lib/store.js";
import { findProfile } from "../lib/profile.js";
import { isSocialCrawler, publicOrigin, shareHtml } from "../lib/opengraph.js";

const router = Router();

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
