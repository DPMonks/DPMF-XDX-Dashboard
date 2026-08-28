import { Router } from "express";
import {
  tradeCatalog,
  ledgerAccountTape,
  ledgerNftOffers,
  lookupIssuedAsset,
  rememberAsset
} from "../lib/assets.js";
import { accountLines } from "../lib/xrpl.js";

const router = Router();

router.get("/catalog", async (req, res) => {
  res.json({ success: true, data: await tradeCatalog(req.query.address) });
});

router.get("/lookup", async (req, res) => {
  const found = await lookupIssuedAsset(req.query.currency, req.query.issuer);
  if (found.ok && req.query.save !== "0") rememberAsset(found.asset);
  res.status(found.ok ? 200 : 400).json({ success: found.ok, data: found });
});

router.post("/lookup", async (req, res) => {
  const found = await lookupIssuedAsset(req.body?.currency, req.body?.issuer);
  if (found.ok) rememberAsset(found.asset);
  res.status(found.ok ? 200 : 400).json({ success: found.ok, data: found });
});

router.get("/wallet/:address", async (req, res) => {
  const [book, lines] = await Promise.all([
    tradeCatalog(req.params.address),
    accountLines(req.params.address)
  ]);
  res.json({
    success: true,
    data: book,
    lines: lines.ok ? lines.result.lines : [],
    xrpl: lines.ok ? "live" : lines.error
  });
});

router.get("/ledger/nft/:nftId/offers", async (req, res) => {
  res.json({ success: true, data: await ledgerNftOffers(req.params.nftId) });
});

router.get("/ledger/account/:address", async (req, res) => {
  res.json({ success: true, data: await ledgerAccountTape(req.params.address) });
});

export default router;
