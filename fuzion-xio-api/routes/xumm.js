import { Router } from "express";
import { readStore, update } from "../lib/store.js";
import { findProfile } from "../lib/profile.js";
import { placeOffer } from "../lib/market.js";
import { paperMark } from "../lib/tradeMarker.js";
import {
  accountFromAuth,
  applySignedIntent,
  balancesForAccount,
  createPayload,
  decodeSession,
  ensureFreeProfile,
  findPayload,
  getPayload,
  nftTokenId,
  notConfigured,
  payloadState,
  pingXaman,
  rememberPayload,
  shapeCreated,
  signSession,
  statusHttp,
  txjsonFor,
  verifySession,
  waitForSigned,
  xamanAppSummary,
  xamanConfigured
} from "../lib/xaman.js";

const router = Router();

function intentFromBody(kind, req, store) {
  const body = req.body || {};
  const account = accountFromAuth(req);
  const { nft, NFTokenID } = nftTokenId(store, body);
  return {
    kind,
    account,
    nftId: nft?._id || body._id || body.nftId || "",
    NFTokenID,
    amount: body.amount,
    currency: body.currency || nft?.currency || "XRP",
    issuer: body.issuerAdd || body.issuer || nft?.issuer || "",
    destAdd: body.destAdd || body.destination || "",
    offerId: body.offerId || "",
    nftOfferIndex: body.nftOfferIndex || body.offerIndex || "",
    Owner: body.nft_owner || body.Owner || nft?.accountNumber || "",
    uri: body.uri || nft?.image || "",
    image: nft?.image || body.image,
    royaltyBps: nft?.royaltyBps,
    taxon: body.taxon
  };
}

async function createSignedPayload(kind, req, res, instruction) {
  if (!xamanConfigured()) {
    return res.status(503).json(notConfigured(kind));
  }
  const store = readStore();
  const intent = intentFromBody(kind, req, store);
  if (kind !== "connect" && kind !== "register" && !intent.account) {
    return res.status(401).json({ success: false, message: "Connect Xaman first." });
  }
  if (["sale", "buy", "burn", "send", "makeOffer"].includes(kind) && !intent.NFTokenID && !intent.nftId) {
    return res.status(400).json({ success: false, message: "NFT id required" });
  }
  const txjson = txjsonFor(kind, intent, intent.account);
  const created = await createPayload(txjson, {
    custom_meta: { instruction: instruction || `FUZION-XIO ${kind}` }
  });
  if (!created.ok) {
    return res.status(created.status || 502).json({
      success: false,
      message: created.error || "Xaman payload failed"
    });
  }
  const shaped = shapeCreated(created.data);
  update((current) => {
    rememberPayload(current, { ...intent, uuid: shaped.uuid, status: "pending" });
    return current;
  });
  return res.json(shaped);
}

async function payloadStatus(req, res) {
  const uuid = req.body?.uuid || req.params.uuid || req.query.uuid;
  if (!uuid) {
    return res.status(400).json({ success: false, message: "uuid required" });
  }
  if (!xamanConfigured()) {
    return res.status(503).json(notConfigured("Xaman status"));
  }
  const got = await getPayload(uuid);
  if (!got.ok) {
    return res.status(got.status || 502).json({
      success: false,
      status: "error",
      message: got.error
    });
  }
  const state = payloadState(got.data);
  const code = statusHttp(state);
  if (state !== "signed") {
    return res.status(code).json({
      success: state === "pending",
      status: state,
      uuid
    });
  }
  const account = got.data.response?.account || "";
  const txid = got.data.response?.txid || "";
  const store = update((current) => {
    const record = findPayload(current, uuid) || { uuid, kind: "connect", account };
    applySignedIntent(current, record, { account, txid });
    return current;
  });
  const record = findPayload(store, uuid);
  return res.status(200).json({
    success: true,
    status: "completed",
    uuid,
    txid,
    account,
    token: account ? signSession(account) : undefined,
    kind: record?.kind
  });
}

async function xamanStatus(_req, res) {
  if (!xamanConfigured()) {
    return res.json({
      success: true,
      configured: false,
      implemented: false,
      pong: false
    });
  }
  const ping = await pingXaman();
  const summary = xamanAppSummary(ping.data || {});
  return res.status(ping.ok ? 200 : 502).json({
    success: ping.ok,
    configured: true,
    implemented: true,
    ...summary,
    message: ping.ok ? undefined : ping.error
  });
}

router.get("/xumm/status", xamanStatus);
router.get("/xaman/status", xamanStatus);
router.post("/xumm/ping", xamanStatus);

router.post("/xumm/connect", async (req, res) => {
  await createSignedPayload("connect", req, res, "Sign in to FUZION-XIO with Xaman");
});

router.post("/xumm/accountDetail", async (req, res) => {
  if (!xamanConfigured()) {
    return res.status(503).json(notConfigured("xumm/accountDetail"));
  }
  const uuid = req.body?.uuid;
  if (!uuid) {
    return res.status(400).json({ success: false, message: "uuid required" });
  }
  const waited = await waitForSigned(uuid, { timeoutMs: 50000, intervalMs: 2000 });
  if (!waited.ok) {
    const message =
      waited.state === "timeout"
        ? "Sign-in timed out. Scan the QR again."
        : waited.state === "cancelled"
          ? "Sign-in was cancelled in Xaman."
          : waited.error || "Xaman did not confirm this sign-in.";
    return res.status(400).json({ success: false, message, status: waited.state });
  }
  const account = waited.account;
  update((current) => {
    rememberPayload(current, {
      uuid,
      kind: "connect",
      account,
      status: "signed",
      txid: waited.txid
    });
    ensureFreeProfile(current, account);
    applySignedIntent(current, { uuid, kind: "connect", account }, waited);
    return current;
  });
  return res.json({
    success: true,
    token: signSession(account),
    account,
    user_type: "secondTime",
    paid: true
  });
});

router.post("/xumm/getBalance", async (req, res) => {
  const account =
    accountFromAuth(req) ||
    decodeSession(req.body?.token)?.ac ||
    "";
  if (!account) {
    return res.status(401).json({
      success: false,
      message: "Connect Xaman first.",
      currency: [{ currency: "XRP", value: "0" }]
    });
  }
  const balances = await balancesForAccount(account);
  return res.json(balances);
});

router.post("/xumm/disConnect", async (req, res) => {
  const uuid = req.body?.uuid;
  if (uuid && xamanConfigured()) {
    await getPayload(uuid).catch(() => null);
  }
  res.json({ success: true, message: "Wallet disconnected" });
});

router.post("/xumm/registrationFee", async (req, res) => {
  await createSignedPayload("register", req, res, "Register a free FUZION-XIO profile");
});

router.post("/xumm/checkRegistrationFee", payloadStatus);

router.get("/xumm/checkProfileRegistartionFee/:id", (req, res) => {
  const store = readStore();
  const address = req.params.id;
  const profile = findProfile(store, address);
  res.json({
    success: true,
    paid: true,
    registered: Boolean(profile),
    data: profile || { wAddress: address }
  });
});

router.post("/xrpl/mintNft", (req, res) =>
  createSignedPayload("mint", req, res, "Mint this NFT on the XRPL")
);
router.post("/xrpl/mintNftOffer", (req, res) =>
  createSignedPayload("sale", req, res, "Create the mint sell offer")
);
router.post("/xrpl/saleNft", (req, res) =>
  createSignedPayload("sale", req, res, "List this NFT for sale")
);
router.post("/xrpl/cancelSaleNft", (req, res) =>
  createSignedPayload("cancelSale", req, res, "Cancel the sell offer")
);
router.post("/xrpl/buyNft", (req, res) =>
  createSignedPayload("buy", req, res, "Buy this NFT on the XRPL")
);
router.post("/xrpl/burnNft", (req, res) =>
  createSignedPayload("burn", req, res, "Burn this NFT")
);
router.post("/xrpl/sendNft", (req, res) =>
  createSignedPayload("send", req, res, "Send this NFT")
);
router.post("/xrpl/cancelSendNft", (req, res) =>
  createSignedPayload("cancelSend", req, res, "Cancel the send offer")
);
router.post("/xrpl/MakeOffer", (req, res) =>
  createSignedPayload("makeOffer", req, res, "Place a buy offer")
);
router.post("/xrpl/acceptPlacedOffer", (req, res) =>
  createSignedPayload("acceptOffer", req, res, "Accept this buy offer")
);
router.post("/xrpl/cancelPlaceOffer", (req, res) =>
  createSignedPayload("cancelOffer", req, res, "Cancel this buy offer")
);

router.post("/xrpl/paymentStatus", payloadStatus);
router.post("/xrpl/webhook", payloadStatus);
router.post("/xrpl/burnStatus", payloadStatus);
router.post("/xrpl/saleStatus", payloadStatus);
router.post("/xrpl/cancelSaleStatus", payloadStatus);
router.post("/xrpl/buyNftStatus", payloadStatus);
router.post("/xrpl/sendStatus", payloadStatus);
router.post("/xrpl/cancelSendStatus", payloadStatus);
router.post("/xrpl/makeOfferStatus", payloadStatus);
router.post("/xrpl/acceptPlacedOfferStatus", payloadStatus);
router.post("/xrpl/cancelPlaceOfferStatus", payloadStatus);
router.post("/xumm/payloadStatus", payloadStatus);

router.post("/xrpl/bidNft", (req, res) => {
  const account = accountFromAuth(req);
  if (!account) {
    return res.status(401).json({ success: false, message: "Connect Xaman first." });
  }
  let result;
  update((current) => {
    result = placeOffer(current, { ...req.body, from: account, ...paperMark() });
    return current;
  });
  if (!result?.ok) {
    return res.status(400).json({ success: false, message: result?.error || "bid failed" });
  }
  res.json({ success: true, data: result.offer });
});

router.get("/nft/verify-payload/:uuid", async (req, res) => {
  req.body = { ...(req.body || {}), uuid: req.params.uuid };
  return payloadStatus(req, res);
});

router.get("/session", (req, res) => {
  const session = verifySession(req.headers.authorization || req.query.token);
  if (!session) {
    return res.status(401).json({ success: false, message: "not signed in" });
  }
  res.json({ success: true, account: session.ac, session });
});

export default router;
