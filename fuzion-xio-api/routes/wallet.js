import { Router } from "express";
import { readStore, update } from "../lib/store.js";
import { feePolicy } from "../lib/fees.js";
import { ensureTrustline, ensureTrustlines, ensureWallet } from "../lib/wallet.js";

const router = Router();

router.get("/fees", (_req, res) => {
  const store = readStore();
  res.json({
    success: true,
    data: feePolicy(),
    collected: (store.fees || []).slice(0, 50),
    count: (store.fees || []).length
  });
});

router.get("/wallet/:address", (req, res) => {
  const store = readStore();
  const wallet = (store.wallets || []).find((row) => row.address === req.params.address) || {
    address: req.params.address,
    trustlines: []
  };
  res.json({
    success: true,
    data: wallet,
    fees: feePolicy()
  });
});

router.get("/wallet/:address/trustlines", (req, res) => {
  const store = readStore();
  const wallet = (store.wallets || []).find((row) => row.address === req.params.address);
  res.json({
    success: true,
    data: wallet?.trustlines || []
  });
});

router.post("/wallet/trustlines", (req, res) => {
  const body = req.body || {};
  const address = body.address || body.wAddress || body.account;
  const assets = Array.isArray(body.assets) && body.assets.length
    ? body.assets
    : [{ currency: body.currency, issuer: body.issuer }];
  let result = null;
  update((current) => {
    if (address) ensureWallet(current, address);
    result = ensureTrustlines(current, { address, assets });
    return current;
  });
  if (!result?.ok && result?.results?.some((row) => !row.ok && !row.skipped)) {
    return res.status(400).json({
      success: false,
      message: result.results.find((row) => !row.ok)?.error || "trustline failed",
      data: result
    });
  }
  res.json({
    success: true,
    message: result.downloaded.length
      ? `Downloaded ${result.downloaded.length} trustline${result.downloaded.length === 1 ? "" : "s"}`
      : "Trustlines already on the wallet",
    data: result
  });
});

router.post("/wallet/trustline", (req, res) => {
  const body = req.body || {};
  let result = null;
  update((current) => {
    result = ensureTrustline(current, {
      address: body.address || body.wAddress,
      currency: body.currency,
      issuer: body.issuer
    });
    return current;
  });
  if (!result?.ok) {
    return res.status(400).json({ success: false, message: result?.error || "trustline failed" });
  }
  res.json({ success: true, data: result });
});

export default router;
