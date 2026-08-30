import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getLiveLpReserves,
  getQuoteMarks,
  getWalletAccount,
  getWalletBalances,
  getWalletLines,
  getWalletLp,
} from "../api/indexer";
import { useWallet } from "../context/useWallet";
import { useI18n } from "../i18n/useI18n";
import { useXamanPayload } from "../xaman/useXamanPayload";
import {
  LEDGER_FEE_XRP,
  ammDepositTx,
  ammWithdrawTx,
  expectedLpTokens,
  expectedSingleLpTokens,
  expectedSingleWithdraw,
  extraTrustLinesNeeded,
  hasLpRow,
  hasLpTrustline,
  hasQuoteTrustline,
  lpTrustSetTxjson,
  notifyWalletRefresh,
  crossAssetSwapTxjson,
  offerCreateBuyXdx,
  offerCreateSellXdx,
  poolForQuote,
  quoteHintsFromLines,
  quoteChoices,
  quoteIdFromPair,
  quoteTrustSetTxjson,
  shouldAskLpTrustline,
  shouldAskQuoteTrustline,
  resolveQuote,
  expectedWithdraw,
  poolPrice,
  predictedQuoteOut,
  quoteUnitUsd,
  depositValueSplit,
  linkedDepositAmounts,
  lpHeldForPair,
  sanitizeQtyInput,
  tradeSides,
  tradeTotal,
  unusedXrpCoversLines,
  xdxUnitUsd,
} from "../xaman/tradeTx";
import { walletAvailableAmounts } from "../wallet/composeWallet";
import { xdxQuoteSpot } from "../wallet/quoteMarker";
import { formatPoolPct, normalizePriceBook, priceBookFromPools } from "../utils/poolSplit";
import { previewReserves } from "../utils/ammInfo";
import { formatToken, formatUsd } from "../utils/format";
import { shortAddress } from "../utils/format";
import { isConsumedUuid, isPayloadUuid, peekPendingPayload } from "../xaman/payloadResume";
import { liveWalletAddress } from "../wallet/walletStorage";
import { xdxPlatformFeeTxjson } from "../swap/platformFee";
import BrandSelect from "./BrandSelect";
import WalletModal from "./WalletModal";

function poolRowForQuote(pools, quote) {
  const pair = String(quote?.pair || poolForQuote(quote).pair || "").toUpperCase();
  return (Array.isArray(pools) ? pools : []).find(
    (item) => String(item.pool || item.pool_name || "").toUpperCase() === pair
  );
}

function poolReserves(pools, quote, live = null) {
  const row = poolRowForQuote(pools, quote) || {};
  const pair = String(quote?.pair || poolForQuote(quote, pools, live).pair || "XDX/XRP").toUpperCase();
  return previewReserves(
    {
      ...row,
      pair,
      tradingFee: row.trading_fee,
      issuer: row.quote_issuer,
      hex: row.quote_hex,
      quoteName: row.quote || pair.split("/")[1] || "XRP",
    },
    live
  );
}

export default function TradePanel({
  action,
  initialQuote = "XRP",
  initialAmount = "",
  quoteExtra = {},
  initialPools = [],
  spotPrice = 0,
  resumeUuid = "",
  resumeTxjson = null,
  onClose,
  onSigned,
}) {
  const { t, locale } = useI18n();
  const { walletAddress, connectWallet } = useWallet();
  const { qr, mobileUrl, uuid, status, error, start, reset } = useXamanPayload();
  const [quoteId, setQuoteId] = useState(() => quoteIdFromPair(initialQuote || "XRP"));
  const [orderType, setOrderType] = useState("market");
  const [lpMode, setLpMode] = useState("double");
  const [singleAsset, setSingleAsset] = useState("xdx");
  const [amount, setAmount] = useState(() => {
    if (action === "addLp" || action === "removeLp") return "";
    if (initialAmount && Number(initialAmount) > 0) return String(initialAmount);
    if (action === "xdxPlatformFee" || action === "crossSwap") return "";
    return "100000";
  });
  const [quoteQty, setQuoteQty] = useState("");
  const [editedSide, setEditedSide] = useState("xdx");
  const [price, setPrice] = useState(spotPrice > 0 ? String(spotPrice) : "");
  const [lpAmount, setLpAmount] = useState("");
  const [walletLp, setWalletLp] = useState([]);
  const [walletLines, setWalletLines] = useState([]);
  const [walletHold, setWalletHold] = useState({});
  const [walletAccount, setWalletAccount] = useState({});
  const [pools, setPools] = useState(() => (Array.isArray(initialPools) ? initialPools : []));
  const [liveReserves, setLiveReserves] = useState(null);
  const [lineHint, setLineHint] = useState("");
  const [lpLineReady, setLpLineReady] = useState(false);
  const [quoteLineReady, setQuoteLineReady] = useState(false);
  const [formError, setFormError] = useState("");
  const [prices, setPrices] = useState(() => priceBookFromPools(initialPools));
  const [ledgerMarks, setLedgerMarks] = useState({});
  const [loadedFor, setLoadedFor] = useState("");
  const startRef = useRef(start);
  const resumeOnceRef = useRef(false);
  const filledPairRef = useRef("");

  const matched = poolRowForQuote(pools, { pair: `XDX/${quoteId}` });
  const quote = useMemo(() => {
    const resolved = resolveQuote(quoteId, {
      ...quoteExtra,
      quote_issuer: quoteExtra?.quoteIssuer || matched?.quote_issuer,
      quote_hex: quoteExtra?.quoteHex || matched?.quote_hex,
      currency: matched?.quote && !String(matched.quote).includes("/") ? matched.quote : quoteExtra?.quote,
      amm: quoteExtra?.amm || matched?.amm_account,
      lp_currency: quoteExtra?.lpCurrency || matched?.lp_currency,
    });
    if (resolved.issuer) return resolved;
    const hinted = quoteHintsFromLines(walletLines, resolved);
    if (!hinted.issuer) return resolved;
    return { ...resolved, issuer: hinted.issuer, hex: hinted.hex || resolved.hex };
  }, [quoteId, quoteExtra, matched, walletLines]);
  const quoteIssuer = quote.issuer || "";
  const quoteHex = quote.hex || "";
  const quotePair = quote.pair || "";
  const isLp = action === "addLp" || action === "removeLp";
  const isPlatformFee = action === "xdxPlatformFee";
  const isCrossSwap = action === "crossSwap";
  const isAutoSign = isPlatformFee || isCrossSwap;
  const account = liveWalletAddress(walletAddress);
  const signedIn = Boolean(account);
  const lpSpec = useMemo(
    () =>
      poolForQuote(quote, pools, {
        ...liveReserves,
        amm_account: liveReserves?.amm_account || quote.amm || matched?.amm_account,
        lp_currency: liveReserves?.lp_currency || quote.lpCurrency || matched?.lp_currency,
      }),
    [quote, pools, liveReserves, matched]
  );
  const haveLpLine =
    lpLineReady ||
    hasLpTrustline(walletLines, lpSpec) ||
    hasLpRow(walletLp, quotePair, quoteId, lpSpec) ||
    lpHeldForPair(walletLp, quotePair, quoteId, lpSpec) > 0;
  const walletReady = !signedIn || loadedFor === `${account || ""}:${action || ""}:${quoteId}`;
  const haveQuoteLine =
    quoteLineReady ||
    hasQuoteTrustline(walletLines, quote) ||
    lineHint.includes(String(quote.hex || "").toUpperCase()) ||
    lineHint.includes(String(quote.issuer || "").toUpperCase()) ||
    lineHint.includes(String(quote.currency || "").toUpperCase());
  const needLpLine =
    action === "removeLp" &&
    signedIn &&
    shouldAskLpTrustline({ loaded: walletReady, haveLine: haveLpLine, spec: lpSpec });
  const isSingleLp = isLp && lpMode === "single";
  const isSingleRemove = action === "removeLp" && lpMode === "single";
  const needQuoteTrust =
    !isPlatformFee &&
    shouldAskQuoteTrustline({
      loaded: walletReady,
      haveLine: haveQuoteLine,
      haveLp: isLp && haveLpLine,
      quote,
    }) &&
    !(isSingleLp && singleAsset === "xdx");
  const reserves = useMemo(() => poolReserves(pools, quote, liveReserves), [pools, quote, liveReserves]);
  const implied = poolPrice(reserves.base, reserves.quote);
  const liveMark = ledgerMarks[quoteId] || null;
  const markerPx =
    Number(liveMark?.xdxPerQuote) > 0
      ? Number(liveMark.xdxPerQuote)
      : xdxQuoteSpot({
          quoteId,
          prices,
          pool: reserves,
          bookMid: liveMark?.bookMid,
          dexPresent: liveMark?.dexPresent,
        });
  const headerSpot = quoteId === "XRP" && Number(spotPrice) > 0 ? Number(spotPrice) : 0;
  const px =
    orderType === "limit" && Number(price) > 0
      ? Number(price)
      : markerPx || (quoteId === "XRP" ? implied || headerSpot : 0);
  const quoteReserve = reserves.quote;
  const linked = linkedDepositAmounts({
    editedSide,
    amount,
    quoteQty,
    price: px,
    reserveBase: reserves.base,
    reserveQuote: quoteReserve,
    preferMark: !isLp,
  });
  const total = tradeTotal(linked.xdx || amount, px);
  const quoteHint = predictedQuoteOut(linked.xdx || amount, px, reserves.base, quoteReserve, {
    preferMark: !isLp,
  });
  const shownAmount = linked.xdxInput;
  const shownQuoteQty = linked.quoteInput;
  const typedXdx = Number(amount) || 0;
  const typedQuote = Number(quoteQty) || 0;
  const addXdx = isSingleLp ? (singleAsset === "xdx" ? typedXdx : 0) : linked.xdx || typedXdx;
  const addQuote = isSingleLp
    ? singleAsset === "quote"
      ? typedQuote
      : 0
    : linked.quote || Number(shownQuoteQty) || Number(quoteHint) || 0;
  const lpHint = isSingleLp
    ? expectedSingleLpTokens(
        singleAsset === "quote" ? addQuote : addXdx,
        singleAsset === "quote" ? quoteReserve : reserves.base,
        reserves.lpSupply
      )
    : expectedLpTokens(addXdx || amount, reserves.base, reserves.lpSupply);
  const xdxUsd = xdxUnitUsd({ pool: reserves, prices });
  const quoteUsd = quoteUnitUsd({ quoteId, pool: reserves, prices, allowImplied: false });
  const withdrawLp = lpAmount || amount;
  const doubleWithdraw = expectedWithdraw(withdrawLp, reserves.base, reserves.quote, reserves.lpSupply);
  const singleOut = isSingleRemove
    ? expectedSingleWithdraw(
        withdrawLp,
        singleAsset === "quote" ? quoteReserve : reserves.base,
        reserves.lpSupply,
        reserves.tradingFee
      )
    : 0;
  const withdraw = isSingleRemove
    ? {
        base: singleAsset === "xdx" ? singleOut : 0,
        quote: singleAsset === "quote" ? singleOut : 0,
      }
    : doubleWithdraw;
  const deposit = isSingleLp
    ? {
        xdxPct: singleAsset === "xdx" ? 100 : 0,
        quotePct: singleAsset === "quote" ? 100 : 0,
        measured: isSingleRemove
          ? singleOut > 0
          : (singleAsset === "xdx" ? typedXdx : typedQuote) > 0,
        total: isSingleRemove
          ? singleOut * (singleAsset === "quote" ? quoteUsd : xdxUsd)
          : singleAsset === "xdx"
            ? typedXdx * xdxUsd
            : typedQuote * quoteUsd,
      }
    : depositValueSplit({
        xdxAmount: action === "removeLp" ? withdraw.base : typedXdx,
        quoteAmount: action === "removeLp" ? withdraw.quote : typedQuote,
        xdxUsd,
        quoteUsd,
      });
  const splitReady = Boolean(deposit.measured);
  const lpHeld = lpHeldForPair(walletLp, quotePair, quoteId, lpSpec);
  const available = walletAvailableAmounts({
    balances: walletHold,
    account: walletAccount,
    lines: walletLines,
    quote,
  });
  const lineCover = unusedXrpCoversLines({
    spendable: available.xrp,
    total:
      Number(walletHold.xrp) > 0
        ? Number(walletHold.xrp)
        : Number(walletAccount.balance_drops) > 0
          ? Number(walletAccount.balance_drops) / 1_000_000
          : walletHold.xrp,
    account: walletAccount,
    extraLines: extraTrustLinesNeeded({
      needLpLine,
      needQuoteTrust,
      action,
      haveLpLine,
    }),
  });
  const sides = tradeSides({
    action,
    amount: isPlatformFee || isCrossSwap ? amount : action === "addLp" ? addXdx : linked.xdx || amount,
    quoteQty: isCrossSwap ? quoteExtra?.receive : action === "addLp" ? addQuote : linked.quote || shownQuoteQty || quoteHint,
    quoteLabel: quote.label,
    fromLabel: quoteExtra?.fromId || quote.label,
    toLabel: quoteExtra?.toId || quote.label,
    total,
    lpAmount: lpAmount || amount,
    lpOut: lpHint,
    withdraw,
    singleAsset: isSingleRemove ? singleAsset : undefined,
  });
  const titles = {
    buy: t.buyXdx,
    sell: t.sellXdx,
    addLp: t.addLiquidity,
    removeLp: t.removeLiquidity,
    xdxPlatformFee: t.xdxPlatformFee || "1% XDX fee",
    crossSwap: t.crossSwapTitle || "Swap",
  };
  const fromQuote = resolveQuote(quoteExtra?.fromId || quoteId, {
    quoteIssuer: quoteExtra?.fromIssuer,
    quoteHex: quoteExtra?.fromHex,
  });
  const toQuote = resolveQuote(quoteExtra?.toId || quoteId, {
    quoteIssuer: quoteExtra?.toIssuer || quote.issuer,
    quoteHex: quoteExtra?.toHex || quote.hex,
  });

  useEffect(() => {
    startRef.current = start;
  }, [start]);

  useEffect(() => {
    if (!action) return undefined;
    let cancelled = false;
    Promise.all([
      getQuoteMarks([quoteId]).catch(() => null),
      account ? getWalletLp(account).catch(() => []) : [],
      account ? getWalletLines(account).catch(() => []) : [],
      account ? getWalletBalances(account).catch(() => ({})) : {},
      account ? getWalletAccount(account).catch(() => ({})) : {},
    ]).then(([payload, nextLp, nextLines, nextHold, nextAccount]) => {
      if (cancelled) return;
      const nextPools = Array.isArray(payload?.pools) ? payload.pools : [];
      if (payload) {
        setLedgerMarks(payload.marks || {});
        if (nextPools.length) setPools(nextPools);
        setPrices((current) =>
          priceBookFromPools(nextPools, {
            ...current,
            ...normalizePriceBook(payload.prices || {}),
          })
        );
      }
      const rows = Array.isArray(nextLp) ? nextLp : [];
      setWalletLp(rows);
      setWalletLines(Array.isArray(nextLines) ? nextLines : []);
      setWalletHold(nextHold && typeof nextHold === "object" ? nextHold : {});
      setWalletAccount(nextAccount && typeof nextAccount === "object" ? nextAccount : {});
      setLineHint(JSON.stringify(nextHold?.raw || {}).toUpperCase());
      setLoadedFor(`${account || ""}:${action || ""}:${quoteId}`);
      if (action === "removeLp") {
        const spec = poolForQuote(
          resolveQuote(quoteId, { quote_issuer: quoteIssuer, quote_hex: quoteHex }),
          nextPools
        );
        const have = lpHeldForPair(rows, quotePair, quoteId, spec);
        const switched = filledPairRef.current !== quotePair;
        filledPairRef.current = quotePair;
        if (switched) setLpAmount(have > 0 ? String(have) : "");
        else if (have > 0) setLpAmount((current) => current || String(have));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [account, action, quoteHex, quoteId, quoteIssuer, quotePair]);

  useEffect(() => {
    if (action !== "addLp" && action !== "removeLp") return undefined;
    let cancelled = false;
    const pair = quotePair || `XDX/${quoteId}`;
    function pull() {
      getLiveLpReserves({
        pair,
        ammAccount:
          quoteId === "XRP" || pair === "XDX/XRP"
            ? lpSpec.amm || matched?.amm_account
            : matched?.amm_account || quote.amm || lpSpec.amm,
        quote: quoteId,
        issuer: quoteIssuer,
        hex: quoteHex,
      })
        .then((live) => {
          if (cancelled) return;
          setLiveReserves(live ? { ...live, pair } : { pair, empty: true });
        })
        .catch(() => {
          if (cancelled) return;
          setLiveReserves((current) => (current?.pair === pair ? current : { pair, empty: true }));
        });
    }
    pull();
    const timer = window.setInterval(pull, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [action, quotePair, quoteId, quoteIssuer, quoteHex, quote.amm, lpSpec.amm, matched?.amm_account]);

  function close() {
    reset();
    onClose?.();
  }

  function onBackdrop(event) {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }

  function buildTx() {
    if (action === "xdxPlatformFee") {
      return xdxPlatformFeeTxjson({ account, xdx: amount });
    }
    if (action === "crossSwap") {
      return crossAssetSwapTxjson({
        account,
        fromQuote,
        toQuote,
        sendMax: amount,
        deliver: quoteExtra?.receive,
        routingMode: quoteExtra?.routingMode,
      });
    }
    if (action === "buy") {
      return offerCreateBuyXdx({
        account,
        quote,
        xdx: linked.xdx || amount,
        cost: linked.quote || shownQuoteQty || total,
        market: orderType === "market",
        routingMode: quoteExtra?.routingMode,
      });
    }
    if (action === "sell") {
      return offerCreateSellXdx({
        account,
        quote,
        xdx: linked.xdx || amount,
        proceeds: linked.quote || shownQuoteQty || total,
        market: orderType === "market",
        routingMode: quoteExtra?.routingMode,
      });
    }
    if (action === "addLp") {
      return ammDepositTx({
        account,
        quote,
        xdx: addXdx,
        quoteQty: addQuote,
        mode: lpMode,
        singleAsset,
      });
    }
    return ammWithdrawTx({
      account,
      quote,
      lpAmount: lpAmount || amount,
      pools,
      live: liveReserves,
      mode: lpMode,
      singleAsset: isSingleRemove ? singleAsset : undefined,
    });
  }

  function tradeIntent() {
    return {
      action,
      quote: quoteId,
      quoteIssuer: quote.issuer || null,
      quoteHex: quote.hex || null,
      pair: quote.pair || `XDX/${quoteId}`,
      ...(isLp ? { lpMode, singleAsset: isSingleLp ? singleAsset : undefined } : {}),
      ...(!isLp ? { amount: Number((isAutoSign ? amount : linked.xdx) || amount) || 0 } : {}),
      ...(action === "addLp"
        ? { amount: addXdx, quoteQty: addQuote, lpOut: Number(lpHint) || 0 }
        : {}),
      ...(action === "removeLp"
        ? { lpAmount: Number(withdrawLp) || 0, withdraw }
        : {}),
      ...(isPlatformFee
        ? { amount: Number(amount) || 0, feeUsd: quoteExtra?.feeUsd || null, nextTrade: quoteExtra?.nextTrade || null }
        : {}),
      ...(isCrossSwap
        ? {
            fromId: quoteExtra?.fromId || null,
            toId: quoteExtra?.toId || quoteId,
            fromIssuer: quoteExtra?.fromIssuer || null,
            fromHex: quoteExtra?.fromHex || null,
            toIssuer: quoteExtra?.toIssuer || quote.issuer || null,
            toHex: quoteExtra?.toHex || quote.hex || null,
            receive: Number(quoteExtra?.receive) || 0,
          }
        : {}),
    };
  }

  function signIn() {
    const live = liveWalletAddress(walletAddress);
    if (live) {
      connectWallet(live);
      return;
    }
    start({
      onSigned: (signedAccount) => connectWallet(signedAccount),
      errorMessage: t.walletError,
    });
  }

  function submit() {
    setFormError("");
    if (!signedIn || !account) {
      signIn();
      return;
    }
    if (!lineCover.ok) {
      setFormError(
        (t.tradeNeedLineReserve || "")
          .replace("{pair}", quotePair || `XDX/${quoteId}` || "this pair")
          .replace("{amount}", formatToken(lineCover.need, locale, 4))
      );
      return;
    }
    if (needLpLine) {
      const line = lpTrustSetTxjson(account, lpSpec);
      if (!line) {
        setFormError(t.needLpTrustline);
        return;
      }
      start({
        body: { txjson: line },
        trade: tradeIntent(),
        onExecuted: () => {
          setLpLineReady(true);
          notifyWalletRefresh();
          getWalletLines(account, { fresh: true })
            .then((rows) => setWalletLines(Array.isArray(rows) ? rows : []))
            .catch(() => {});
        },
        onFailed: () => {
          setFormError(t.lpTrustlineError);
        },
        errorMessage: t.lpTrustlineError,
      });
      return;
    }
    if (needQuoteTrust && quote.issuer) {
      const line = quoteTrustSetTxjson(account, quote);
      start({
        body: { txjson: line },
        trade: tradeIntent(),
        onExecuted: () => {
          setQuoteLineReady(true);
          setLineHint((current) => `${current} ${quote.currency} ${quote.issuer}`.toUpperCase());
          notifyWalletRefresh();
        },
        errorMessage: t.trustlineError,
      });
      return;
    }
    const removeQty = Number(lpAmount || amount);
    const tradeQty = Number(linked.xdx || amount);
    if (action === "removeLp" && !(removeQty > 0)) {
      setFormError(t.tradeNeedAmount);
      return;
    }
    if (isSingleRemove && !(singleOut > 0)) {
      setFormError(t.tradeNeedAmount);
      return;
    }
    if (action === "removeLp" && !isSingleRemove && (!(withdraw.base > 0) || !(withdraw.quote > 0))) {
      setFormError(t.lpTooSmall || t.tradeNeedAmount);
      return;
    }
    if (action === "addLp") {
      const haveDeposit = isSingleLp
        ? singleAsset === "quote"
          ? addQuote > 0
          : addXdx > 0
        : addXdx > 0 && addQuote > 0;
      if (!haveDeposit) {
        setFormError(t.tradeNeedAmount);
        return;
      }
    } else if (action !== "removeLp" && !(Number(isAutoSign ? amount : tradeQty) > 0)) {
      setFormError(t.tradeNeedAmount);
      return;
    }
    if (action === "addLp" && quote.currency !== "XRP" && !quote.issuer) {
      setFormError(t.tradeNeedTrustline);
      return;
    }
    if (!isLp && !isAutoSign && !(px > 0)) {
      setFormError(t.tradeNeedPrice);
      return;
    }
    if (isPlatformFee) {
      const feeTx = xdxPlatformFeeTxjson({ account, xdx: amount });
      if (!feeTx) {
        if (quoteExtra?.nextTrade) onClose(quoteExtra.nextTrade);
        else setFormError(t.tradeNeedAmount);
        return;
      }
    }
    start({
      body: { txjson: buildTx() },
      trade: tradeIntent(),
      onSigned: () => {
        notifyWalletRefresh();
      },
      onExecuted: () => {
        notifyWalletRefresh();
        onSigned?.();
        if (isPlatformFee && quoteExtra?.nextTrade) {
          onClose(quoteExtra.nextTrade);
          return;
        }
        onClose();
      },
      onFailed: (detection) => {
        setFormError(
          `${t.tradeFailed}${detection?.engineResult ? ` · ${detection.engineResult}` : ""}`
        );
      },
      errorMessage: t.tradeSignError,
    });
  }

  useEffect(() => {
    const id = String(resumeUuid || "").trim();
    const pending = peekPendingPayload();
    if (
      !isPayloadUuid(id) ||
      isConsumedUuid(id) ||
      pending?.signState === "executed" ||
      (pending?.uuid && pending.uuid !== id) ||
      !signedIn ||
      resumeOnceRef.current
    ) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      if (resumeOnceRef.current) return;
      resumeOnceRef.current = true;
      startRef.current({
        resumeUuid: id,
        body: { txjson: resumeTxjson || { TransactionType: action === "addLp" ? "AMMDeposit" : action === "removeLp" ? "AMMWithdraw" : "Payment" } },
        trade: {
          action,
          quote: quoteId,
          quoteIssuer: quoteIssuer || null,
          quoteHex: quoteHex || null,
          pair: quotePair || `XDX/${quoteId}`,
        },
        onSigned: () => {
          notifyWalletRefresh();
        },
        onExecuted: () => {
          notifyWalletRefresh();
          onSigned?.();
          if (action === "xdxPlatformFee" && quoteExtra?.nextTrade) {
            onClose(quoteExtra.nextTrade);
            return;
          }
          onClose();
        },
        onFailed: (detection) => {
          setFormError(
            `${t.tradeFailed}${detection?.engineResult ? ` · ${detection.engineResult}` : ""}`
          );
        },
        errorMessage: t.tradeSignError,
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [
    action,
    onClose,
    onSigned,
    quoteHex,
    quoteId,
    quoteIssuer,
    quotePair,
    resumeTxjson,
    resumeUuid,
    signedIn,
    t.tradeFailed,
    t.tradeSignError,
  ]);

  if (!action) return null;

  return createPortal(
    <div className="wallet-modal-overlay" onPointerDown={onBackdrop} onClick={(event) => event.stopPropagation()}>
      <div
        className="wallet-modal trade-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-panel-title"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="trade-panel-title" className="modal-title">
          {needLpLine ? t.lpTrustline : titles[action] || t.tradeActions}
        </h2>
        {signedIn ? (
          <p className="trade-panel-account">{shortAddress(account)}</p>
        ) : (
          <p className="trade-panel-hint">{t.signInToTrade}</p>
        )}
        {needLpLine ? <p className="trade-panel-hint">{t.needLpTrustline}</p> : null}
        {isPlatformFee ? (
          <>
            <p className="trade-panel-hint">{t.swapPlatformFeeHint}</p>
            <p className="trade-panel-account">{formatToken(amount, locale, 6)} XDX</p>
          </>
        ) : null}
        {isCrossSwap ? (
          <p className="trade-panel-hint">
            {`${quoteExtra?.fromId || ""} → ${quoteExtra?.toId || quoteId}`}
          </p>
        ) : null}

        {isAutoSign ? null : (
        <>
        <label className="trade-field">
          {t.tradePair}
          <BrandSelect
            value={quoteId}
            options={quoteChoices(pools).map((id) => ({ id, label: `XDX / ${id}` }))}
            onChange={(id) => {
              setQuoteId(id);
              setQuoteQty("");
              setEditedSide("xdx");
              setPrice("");
              setLpLineReady(false);
              setQuoteLineReady(false);
            }}
            ariaLabel={t.tradePair}
            searchable
            placeholder={t.searchPair || t.tradePair}
          />
        </label>

        {isLp ? (
          <>
            <div
              className="tabs trade-lp-mode"
              role="tablist"
              aria-label={action === "removeLp" ? t.lpWithdrawMode || t.lpDepositMode : t.lpDepositMode}
            >
              <button
                type="button"
                role="tab"
                aria-selected={lpMode === "double"}
                className={`tab${lpMode === "double" ? " active" : ""}`}
                onClick={() => setLpMode("double")}
              >
                {t.lpDoubleSided}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={lpMode === "single"}
                className={`tab${lpMode === "single" ? " active" : ""}`}
                onClick={() => {
                  setLpMode("single");
                  setSingleAsset(editedSide === "quote" ? "quote" : "xdx");
                }}
              >
                {t.lpSingleSided}
              </button>
            </div>
            {isSingleLp ? (
              <>
                <div className="tabs trade-lp-asset" role="tablist" aria-label={t.lpSingleAsset}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={singleAsset === "xdx"}
                    className={`tab${singleAsset === "xdx" ? " active" : ""}`}
                    onClick={() => {
                      setSingleAsset("xdx");
                      setEditedSide("xdx");
                    }}
                  >
                    XDX
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={singleAsset === "quote"}
                    className={`tab${singleAsset === "quote" ? " active" : ""}`}
                    onClick={() => {
                      setSingleAsset("quote");
                      setEditedSide("quote");
                    }}
                  >
                    {quote.label}
                  </button>
                </div>
                <p className="trade-panel-hint trade-lp-hint">
                  {action === "removeLp" ? t.lpSingleRemoveHint || t.lpSingleHint : t.lpSingleHint}
                </p>
              </>
            ) : null}
          </>
        ) : null}

        {needLpLine ? null : !isLp ? (
          <label className="trade-field">
            {t.tradeOrderType}
            <BrandSelect
              value={orderType}
              options={[
                { id: "market", label: t.tradeMarket },
                { id: "limit", label: t.tradeLimit },
              ]}
              onChange={(id) => {
                setOrderType(id);
                if (id === "limit" && markerPx > 0) setPrice(String(markerPx));
              }}
              ariaLabel={t.tradeOrderType}
            />
          </label>
        ) : null}

        {needLpLine ? null : (
        <>
        {action === "removeLp" ? (
          <label className="trade-field">
            {t.tradeLpTokens}
            <input
              type="number"
              min="0"
              step="any"
              value={lpAmount}
              onChange={(event) => setLpAmount(event.target.value)}
            />
            {signedIn ? (
              <span className="trade-field-usd">
                {t.tradeLpHeld}: {formatToken(lpHeld, locale, 6)}
              </span>
            ) : (
              <span className="trade-lp-disconnected">{t.walletNotConnected}</span>
            )}
          </label>
        ) : isSingleLp && singleAsset === "quote" ? null : (
          <label className="trade-field">
            {t.xdxAmount}
            <input
              type={isLp ? "text" : "number"}
              inputMode="decimal"
              autoComplete="off"
              min="0"
              step="any"
              value={isLp ? amount : shownAmount}
              placeholder={isLp && !amount && linked.xdxInput ? linked.xdxInput : undefined}
              onChange={(event) => {
                const next = isLp ? sanitizeQtyInput(event.target.value) : event.target.value;
                if (next == null) return;
                setEditedSide("xdx");
                setAmount(next);
              }}
            />
            {action === "addLp" ? (
              <>
                <span className="trade-field-usd">
                  {xdxUsd > 0 && typedXdx > 0 ? formatUsd(typedXdx * xdxUsd, locale) : "—"}
                </span>
                <span className="trade-field-usd">
                  {(t.createPoolAvailable || "Available {amount} {asset}")
                    .replace(
                      "{amount}",
                      signedIn && available.xdx != null ? formatToken(available.xdx, locale, 6) : "—"
                    )
                    .replace("{asset}", "XDX")}
                </span>
              </>
            ) : null}
          </label>
        )}
        {action === "removeLp" && (!isSingleRemove || singleAsset === "xdx") ? (
          <label className="trade-field">
            {t.xdxAmount}
            <input type="text" readOnly value={formatToken(withdraw.base, locale, 6)} />
            <span className="trade-field-usd">
              {xdxUsd > 0 ? formatUsd(withdraw.base * xdxUsd, locale) : "—"}
            </span>
          </label>
        ) : null}
        {isLp ? (
          <div
            className={`pool-split trade-deposit-split ${
              splitReady ? (deposit.xdxPct >= deposit.quotePct ? "is-xdx-lead" : "is-quote-lead") : "is-pending"
            }`}
          >
            <div className="pool-split-labels">
              <span className="pool-split-xdx">
                <i className="pool-split-swatch is-xdx" aria-hidden="true" />
                <span className="pool-split-pct">{splitReady ? `${formatPoolPct(deposit.xdxPct)}%` : "—"}</span>
                <span className="pool-split-asset">XDX</span>
              </span>
              <span className="pool-split-ratio">
                {splitReady
                  ? `${formatPoolPct(deposit.xdxPct)} / ${formatPoolPct(deposit.quotePct)}`
                  : quoteUsd > 0
                    ? formatUsd(deposit.total, locale)
                    : "—"}
              </span>
              <span className="pool-split-quote">
                <span className="pool-split-pct">{splitReady ? `${formatPoolPct(deposit.quotePct)}%` : "—"}</span>
                <span className="pool-split-asset">{quote.label}</span>
                <i className="pool-split-swatch is-quote" aria-hidden="true" />
              </span>
            </div>
            <div
              className="pool-split-bar"
              role="img"
              aria-label={`${formatPoolPct(deposit.xdxPct)} percent XDX, ${formatPoolPct(deposit.quotePct)} percent ${quote.label}`}
            >
              <span
                className="pool-split-bar-xdx"
                style={{ flexGrow: Math.max(deposit.xdxPct, 0), flexShrink: 0, flexBasis: 0 }}
              />
              <span
                className="pool-split-bar-quote"
                style={{ flexGrow: Math.max(deposit.quotePct, 0), flexShrink: 0, flexBasis: 0 }}
              />
              <i className="pool-split-mid" aria-hidden="true" />
            </div>
          </div>
        ) : null}
        {action === "removeLp" && (!isSingleRemove || singleAsset === "quote") ? (
          <label className="trade-field">
            {quote.label}
            <input type="text" readOnly value={formatToken(withdraw.quote, locale, 6)} />
            <span className="trade-field-usd">
              {quoteUsd > 0 ? formatUsd(withdraw.quote * quoteUsd, locale) : "—"}
            </span>
          </label>
        ) : isSingleLp && singleAsset === "xdx" ? null : (
          <label className="trade-field">
            {quote.label}
            <input
              type={isLp ? "text" : "number"}
              inputMode="decimal"
              autoComplete="off"
              min="0"
              step="any"
              value={isLp ? quoteQty : shownQuoteQty}
              placeholder={isLp && !quoteQty && linked.quoteInput ? linked.quoteInput : undefined}
              onChange={(event) => {
                const next = isLp ? sanitizeQtyInput(event.target.value) : event.target.value;
                if (next == null) return;
                setEditedSide("quote");
                setQuoteQty(next);
              }}
            />
            {action === "addLp" ? (
              <>
                <span className="trade-field-usd">
                  {quoteUsd > 0 && typedQuote > 0 ? formatUsd(typedQuote * quoteUsd, locale) : "—"}
                </span>
                <span className="trade-field-usd">
                  {(t.createPoolAvailable || "Available {amount} {asset}")
                    .replace(
                      "{amount}",
                      signedIn && available.quote != null ? formatToken(available.quote, locale, 6) : "—"
                    )
                    .replace("{asset}", quote.label)}
                </span>
              </>
            ) : null}
          </label>
        )}

        {!isLp && orderType === "limit" ? (
          <label className="trade-field">
            {t.tradePrice} ({quote.label})
            <input type="number" min="0" step="any" value={price} onChange={(event) => setPrice(event.target.value)} />
          </label>
        ) : null}

        <dl className="trade-summary">
          <div>
            <dt>{t.tradeCost}</dt>
            <dd>
              {sides.pay.map((row) => (
                <span key={`pay-${row.asset}`}>
                  {formatToken(row.value, locale, 6)} {row.asset}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt>{t.tradeProceeds}</dt>
            <dd>
              {sides.receive.map((row) => (
                <span key={`get-${row.asset}`}>
                  {formatToken(row.value, locale, 6)} {row.asset}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt>{t.tradeFee}</dt>
            <dd>~{LEDGER_FEE_XRP} XRP</dd>
          </div>
        </dl>
        </>
        )}
        </>
        )}

        {needLpLine ? null : needQuoteTrust && quote.issuer && signedIn ? (
          <p className="trade-panel-hint">{t.tradeNeedTrustline}</p>
        ) : null}
        {signedIn && !lineCover.ok ? (
          <p className="trade-panel-hint">
            {(t.tradeNeedLineReserve || "")
              .replace("{pair}", quotePair || `XDX/${quoteId}`)
              .replace("{amount}", formatToken(lineCover.need, locale, 4))}
          </p>
        ) : null}
        {formError ? <p className="wallet-error">{formError}</p> : null}
        {error ? <p className="wallet-error">{error}</p> : null}

        <div className="trade-panel-actions">
          <button type="button" className="connect-wallet-btn" onClick={submit}>
            {!signedIn
              ? t.signInToTrade
              : needLpLine
                ? t.lpTrustline
                : needQuoteTrust && quote.issuer
                  ? t.quoteTrustline.replace("{asset}", quote.label)
                  : t.tradeSign}
          </button>
          <button type="button" className="cancel-wallet-btn" onClick={close}>
            {t.cancel}
          </button>
        </div>
      </div>
      <WalletModal
        visible={status === "loading" || status === "waiting" || status === "confirming"}
        qrUrl={qr}
        mobileUrl={mobileUrl}
        uuid={uuid}
        status={status}
        preparingLabel={
          needLpLine
            ? t.preparingLpTrustline
            : needQuoteTrust && quote.issuer
              ? t.preparingTrustline
              : t.preparingTrade
        }
        scanLabel={
          status === "confirming"
            ? needLpLine
              ? t.confirmingLpTrustline
              : needQuoteTrust && quote.issuer
                ? t.confirmingTrustline
                : t.confirmingTrade
            : needLpLine
              ? t.scanLpTrustline
              : needQuoteTrust && quote.issuer
                ? t.scanTrustline
                : t.scanTrade
        }
        onClose={reset}
      />
    </div>,
    document.body
  );
}
