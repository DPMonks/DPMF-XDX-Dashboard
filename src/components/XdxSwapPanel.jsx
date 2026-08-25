import { useEffect, useMemo, useState } from "react";
import {
  getAmm,
  getLiveLpReserves,
  getOrderbook,
  getPrices,
  getWalletAccount,
  getWalletBalances,
  getWalletLines,
} from "../api/indexer";
import { XDX_FEE_TREASURY } from "../constants/ledger";
import { useWallet } from "../context/useWallet";
import { useI18n } from "../i18n/useI18n";
import { ammSpot } from "../ammCurve";
import { bookHeader, emptyOrderbook, normalizeOrderbookPair } from "../orderbook";
import { IMPACT_HIGH_PCT, IMPACT_WARN_PCT, quoteBridgeSwap, quoteSwap, saferSwapAlternatives } from "../swap/quoteSwap";
import {
  needsXdxPlatformFee,
  shouldSkipXdxPlatformFee,
  swapAssetUsd,
  tradeNotionalUsd,
  xdxPlatformFeeFromUsd,
} from "../swap/platformFee";
import { swapAssetOptions } from "../swap/swapAssets";
import { liveWalletAddress } from "../wallet/walletStorage";
import { walletAvailableAmounts } from "../wallet/composeWallet";
import { formatPercent, formatToken, formatUsd, shortAddress } from "../utils/format";
import { normalizePriceBook } from "../utils/poolSplit";
import { sanitizeQtyInput, xdxUnitUsd } from "../xaman/tradeTx";
import BrandSelect from "./BrandSelect";

const SWAP_PCTS = [25, 50, 75, 100];

function amountAtPercent(available, pct) {
  const hold = Number(available) * (Number(pct) / 100);
  if (!(hold > 0)) return "";
  const text = hold >= 1_000_000 ? String(Math.round(hold)) : hold.toPrecision(8);
  return String(Number(/[eE]/.test(text) ? hold.toFixed(8) : text));
}

function reserveFrom(book, live) {
  return {
    reserveBase: Number(live?.reserve_xdx ?? live?.reserve_asset ?? book?.amm?.reserve_asset ?? 0),
    reserveQuote: Number(live?.reserve_currency ?? live?.reserve_quote ?? book?.amm?.reserve_currency ?? 0),
    tradingFee: Number(live?.trading_fee ?? book?.amm?.trading_fee ?? 1000),
  };
}

function venueFrom(book, live) {
  const reserves = reserveFrom(book, live);
  const header = bookHeader(book || emptyOrderbook("XDX/XRP"));
  return {
    mid: header.mid || ammSpot(reserves.reserveBase, reserves.reserveQuote),
    bids: book?.bids || [],
    asks: book?.asks || [],
    reserveBase: reserves.reserveBase,
    reserveQuote: reserves.reserveQuote,
    tradingFee: reserves.tradingFee,
  };
}

function tickerOf(asset, fallback) {
  return String(asset?.ticker || asset?.id || fallback || "")
    .split(":")[0]
    .toUpperCase();
}

export default function XdxSwapPanel() {
  const { t, locale } = useI18n();
  const { walletAddress } = useWallet();
  const account = liveWalletAddress(walletAddress);
  const [fromId, setFromId] = useState("XDX");
  const [toId, setToId] = useState("XRP");
  const [amount, setAmount] = useState("");
  const [routingMode, setRoutingMode] = useState("smart");
  const [lines, setLines] = useState([]);
  const [balances, setBalances] = useState({});
  const [walletAccount, setWalletAccount] = useState({});
  const [pools, setPools] = useState([]);
  const [markets, setMarkets] = useState({});
  const [prices, setPrices] = useState({});

  const assets = useMemo(
    () =>
      swapAssetOptions({
        pools,
        lines,
        balances: { xdx: balances.xdx, xrp: balances.xrp },
        signedIn: Boolean(account),
      }),
    [account, balances, lines, pools]
  );
  const fromAsset = assets.find((row) => row.id === fromId) || assets.find((row) => row.id === "XDX") || assets[0];
  const toAsset =
    assets.find((row) => row.id === toId && row.id !== fromAsset?.id) ||
    assets.find((row) => row.id !== fromAsset?.id) ||
    assets[0];
  const effectiveFrom = fromAsset?.id || "XDX";
  const effectiveTo = toAsset?.id || "XRP";
  const fromTicker = tickerOf(fromAsset, effectiveFrom);
  const toTicker = tickerOf(toAsset, effectiveTo);
  const sellingXdx = fromTicker === "XDX";
  const buyingXdx = toTicker === "XDX";
  const needsFee = needsXdxPlatformFee(fromTicker, toTicker);
  const fromPair = fromTicker === "XDX" ? null : normalizeOrderbookPair(`XDX/${fromTicker}`);
  const toPair = toTicker === "XDX" ? null : normalizeOrderbookPair(`XDX/${toTicker}`);
  const pair = needsFee ? `${fromTicker} → ${toTicker}` : `XDX/${sellingXdx ? toTicker : fromTicker}`;
  const marketKey = [fromPair, toPair].filter(Boolean).join("|");

  useEffect(() => {
    let cancelled = false;
    async function loadWallet() {
      if (!account) {
        setLines([]);
        setBalances({});
        setWalletAccount({});
        return;
      }
      const [nextLines, nextBal, nextAccount] = await Promise.all([
        getWalletLines(account).catch(() => []),
        getWalletBalances(account).catch(() => ({})),
        getWalletAccount(account).catch(() => ({})),
      ]);
      if (cancelled) return;
      setLines(Array.isArray(nextLines) ? nextLines : nextLines?.lines || []);
      setBalances(nextBal || {});
      setWalletAccount(nextAccount || {});
    }
    loadWallet();
    return () => {
      cancelled = true;
    };
  }, [account]);

  useEffect(() => {
    let cancelled = false;
    async function loadMarket() {
      const pairs = marketKey ? marketKey.split("|") : [];
      const [nextPools, nextPrices, ...pairRows] = await Promise.all([
        getAmm().catch(() => []),
        getPrices().catch(() => ({})),
        ...pairs.map(async (nextPair) => {
          const [book, live] = await Promise.all([
            getOrderbook(nextPair).catch(() => null),
            getLiveLpReserves({ pair: nextPair }).catch(() => null),
          ]);
          return [nextPair, { book: book || emptyOrderbook(nextPair), live }];
        }),
      ]);
      if (cancelled) return;
      setPools(Array.isArray(nextPools) ? nextPools : nextPools?.pools || []);
      setPrices(nextPrices || {});
      setMarkets(Object.fromEntries(pairRows));
    }
    loadMarket();
    const id = setInterval(loadMarket, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [marketKey]);

  const hold = walletAvailableAmounts({
    balances,
    account: walletAccount,
    lines,
    quote: fromTicker === "XRP" || !fromAsset?.issuer ? { currency: "XRP" } : fromAsset,
  });
  const available =
    fromTicker === "XDX" ? hold.xdx : fromTicker === "XRP" || !fromAsset?.issuer ? hold.xrp : hold.quote;
  const qty = Number(amount) || 0;
  const fromVenue = venueFrom(markets[fromPair]?.book, markets[fromPair]?.live);
  const toVenue = venueFrom(markets[toPair]?.book, markets[toPair]?.live);
  const quote = (() => {
    if (!(qty > 0)) return null;
    if (sellingXdx) return quoteSwap({ ...toVenue, amountIn: qty, sellingXdx: true, routingMode });
    if (buyingXdx) return quoteSwap({ ...fromVenue, amountIn: qty, sellingXdx: false, routingMode });
    return quoteBridgeSwap({ amountIn: qty, fromVenue, toVenue, routingMode });
  })();
  const impactHot =
    quote && (Math.abs(quote.priceImpactPercent) >= IMPACT_WARN_PCT || quote.isNegativeSlippage);
  const impactHigh = quote && Math.abs(quote.priceImpactPercent) >= IMPACT_HIGH_PCT;
  const quoteExtras = sellingXdx
    ? { ...toVenue, sellingXdx: true, routingMode }
    : buyingXdx
      ? { ...fromVenue, sellingXdx: false, routingMode }
      : null;
  const alternatives = impactHigh && quoteExtras ? saferSwapAlternatives(qty, quote, quoteExtras) : [];
  const noRoute = Boolean(qty > 0 && (!quote || quote.routeUsed === "none" || !(quote.actualOutput > 0)));
  const book = normalizePriceBook(prices);
  const xdxUsd = xdxUnitUsd({ prices: book }) || Number(book.xdxUsd) || 0;
  const payUsd = swapAssetUsd({ id: fromTicker, ticker: fromTicker, pools, prices: book });
  const receiveUsd = swapAssetUsd({ id: toTicker, ticker: toTicker, pools, prices: book });
  const tradeUsd = tradeNotionalUsd({
    payAmount: qty,
    payUsd,
    receiveAmount: quote?.actualOutput,
    receiveUsd,
    xdxNotional: quote?.xdxNotional,
    xdxUsd,
  });
  const feeXdx = needsFee ? xdxPlatformFeeFromUsd({ tradeUsd, xdxUsd }) : 0;
  const skipFee = shouldSkipXdxPlatformFee({ account, treasury: XDX_FEE_TREASURY, xdx: feeXdx });
  const chargeFee = Boolean(needsFee && feeXdx > 0 && !skipFee);
  const missingFeePrice = Boolean(needsFee && qty > 0 && !(feeXdx > 0) && !skipFee);
  const shortXdx = hold.xdx != null && chargeFee && Number(hold.xdx) < feeXdx;

  function changeFrom(id) {
    const next = String(id || "").toUpperCase();
    if (!next) return;
    setFromId(next);
    if (next === effectiveTo) {
      const other = assets.find((row) => row.id !== next);
      if (other) setToId(other.id);
    }
  }

  function changeTo(id) {
    const next = String(id || "").toUpperCase();
    if (!next) return;
    setToId(next);
    if (next === effectiveFrom) {
      const other = assets.find((row) => row.id !== next);
      if (other) setFromId(other.id);
    }
  }

  function buyXdx() {
    const counter = fromTicker !== "XDX" ? effectiveFrom : toTicker !== "XDX" ? effectiveTo : "XRP";
    setFromId(counter);
    setToId("XDX");
  }

  function sellXdx() {
    const counter = toTicker !== "XDX" ? effectiveTo : fromTicker !== "XDX" ? effectiveFrom : "XRP";
    setFromId("XDX");
    setToId(counter);
  }

  function swapDetail(nextAmount = qty, nextMode = routingMode) {
    if (sellingXdx) {
      return {
        action: "sell",
        quote: toTicker,
        quoteIssuer: toAsset?.issuer,
        quoteHex: toAsset?.hex,
        amount: nextAmount,
        routingMode: nextMode,
      };
    }
    if (buyingXdx) {
      return {
        action: "buy",
        quote: fromTicker,
        quoteIssuer: fromAsset?.issuer,
        quoteHex: fromAsset?.hex,
        amount: quote?.actualOutput,
        routingMode: nextMode,
      };
    }
    return {
      action: "crossSwap",
      quote: toTicker,
      quoteIssuer: toAsset?.issuer,
      quoteHex: toAsset?.hex,
      fromId: fromTicker,
      toId: toTicker,
      fromIssuer: fromAsset?.issuer,
      fromHex: fromAsset?.hex,
      toIssuer: toAsset?.issuer,
      toHex: toAsset?.hex,
      amount: nextAmount,
      receive: quote?.actualOutput,
      routingMode: nextMode,
    };
  }

  function openSwap(nextAmount = qty, nextMode = routingMode) {
    const next = swapDetail(nextAmount, nextMode);
    if (chargeFee) {
      window.dispatchEvent(
        new CustomEvent("dpmf-open-trade", {
          detail: {
            action: "xdxPlatformFee",
            amount: feeXdx,
            feeUsd: tradeUsd * 0.01,
            nextTrade: next,
          },
        })
      );
      return;
    }
    window.dispatchEvent(new CustomEvent("dpmf-open-trade", { detail: next }));
  }

  const fromSelect = (
    <BrandSelect
      value={effectiveFrom}
      options={assets.filter((row) => row.id !== effectiveTo)}
      onChange={changeFrom}
      ariaLabel={t.swapPay || "Pay"}
      searchable
    />
  );
  const toSelect = (
    <BrandSelect
      value={effectiveTo}
      options={assets.filter((row) => row.id !== effectiveFrom)}
      onChange={changeTo}
      ariaLabel={t.swapGet || "Get"}
      searchable
    />
  );
  const haveText =
    account && available != null
      ? (t.swapHave || "Have {amount}").replace("{amount}", formatToken(available, locale, sellingXdx ? 2 : 4))
      : "";
  const gotFill = Boolean(quote?.actualOutput > 0);
  const routeLabel = gotFill
    ? quote.routeUsed === "amm"
      ? t.swapRoutePool || "Pool"
      : quote.routeUsed === "book"
        ? t.swapBook || "Book"
        : quote.routeUsed === "bridge"
          ? t.swapRouteBridge || "Via XDX"
          : t.swapSmart
    : "";
  const feeLabel = chargeFee
    ? (t.swapPlatformFee || "1% XDX fee · {amount} XDX (~{usd})")
        .replace("{amount}", formatToken(feeXdx, locale, 2))
        .replace("{usd}", formatUsd(tradeUsd * 0.01, locale))
    : "";
  const swapLocked = noRoute || !(qty > 0) || shortXdx || missingFeePrice;

  return (
    <section className="xdx-swap" aria-label={t.swapTitle}>
      <div className="xdx-swap-head">
        <h3 className="orderbook-title">{t.swapTitle}</h3>
        <p className="xdx-swap-pair">{pair}</p>
      </div>

      <div className="xdx-swap-box">
        <div className="xdx-swap-modes" role="group" aria-label={t.swapDirection}>
          <button type="button" className={buyingXdx ? "is-on is-buy" : ""} aria-pressed={buyingXdx} onClick={buyXdx}>
            {t.swapBuyXdx}
          </button>
          <button type="button" className={sellingXdx ? "is-on is-sell" : ""} aria-pressed={sellingXdx} onClick={sellXdx}>
            {t.swapSellXdx}
          </button>
        </div>

        <div className="xdx-swap-row">
          <span>{t.swapPay || "Pay"}</span>
          <input
            type="text"
            inputMode="decimal"
            className="xdx-swap-input"
            value={amount}
            placeholder="0"
            aria-label={t.swapAmount}
            onChange={(event) => setAmount(sanitizeQtyInput(event.target.value))}
          />
          {fromSelect}
        </div>
        <div className="xdx-swap-tools">
          <div className="xdx-swap-pcts" role="group" aria-label={t.swapPercents}>
            {SWAP_PCTS.map((pct) => {
              const next = amountAtPercent(available, pct);
              const on = next !== "" && amount === next;
              return (
                <button
                  key={pct}
                  type="button"
                  className={on ? "is-on" : ""}
                  disabled={!account || !(available > 0)}
                  onClick={() => setAmount(next)}
                >
                  {pct}%
                </button>
              );
            })}
          </div>
          {haveText ? <p className="xdx-swap-hold">{haveText}</p> : null}
        </div>

        <div className="xdx-swap-row">
          <span>{t.swapGet || "Get"}</span>
          <p className="xdx-swap-out">
            {gotFill ? formatToken(quote.actualOutput, locale, sellingXdx ? 4 : 2) : "—"}
          </p>
          {toSelect}
        </div>
      </div>

      {gotFill ? (
        <p className={`xdx-swap-result${impactHot ? " is-warn" : ""}`}>
          {routeLabel}
          {quote.slippagePercent != null ? ` · ${formatPercent(quote.slippagePercent, locale)}` : ""}
        </p>
      ) : noRoute ? (
        <p className="xdx-swap-warn">{routingMode === "book" ? t.swapNoBook || t.swapNoRoute : t.swapNoRoute}</p>
      ) : null}
      {quote?.partialFill ? <p className="xdx-swap-warn">{t.swapPartialFill}</p> : null}
      {chargeFee ? (
        <p className="xdx-swap-fee">
          {feeLabel}
          {` · ${shortAddress(XDX_FEE_TREASURY)}`}
        </p>
      ) : null}
      {chargeFee ? <p className="xdx-swap-fee">{t.swapPlatformFeeHint}</p> : null}
      {missingFeePrice ? <p className="xdx-swap-warn">{t.swapNoFeePrice}</p> : null}
      {shortXdx ? (
        <p className="xdx-swap-warn">
          {(t.swapPlatformFeeNeed || "Need {amount} XDX in this wallet for the 1% fee.").replace(
            "{amount}",
            formatToken(feeXdx, locale, 2)
          )}
        </p>
      ) : null}

      {alternatives.length ? (
        <div className="xdx-swap-alts">
          {alternatives.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                if (row.id === "half") setAmount(String(row.amountIn));
                if (row.id === "amm" || row.id === "book") setRoutingMode(row.id);
              }}
            >
              {row.id === "half" ? t.swapSaferHalf : row.id === "amm" ? t.swapSaferAmm : t.swapSaferBook}
            </button>
          ))}
        </div>
      ) : null}

      <div className="xdx-swap-foot">
        <button type="button" className="connect-wallet-btn" disabled={swapLocked} onClick={() => openSwap()}>
          {account ? (chargeFee ? t.swapPayFee : t.swapAction) : t.swapConnect}
        </button>
        <div className="xdx-swap-routes" role="radiogroup" aria-label={t.swapRouting}>
          {[
            ["smart", t.swapChipSmart || "Smart (mixed fee of 0-1%)"],
            ["amm", t.swapChipAmm || "AMM only (0-1% fee)"],
            ["book", t.swapChipBook || "Order book only (no AMM fee 0%)"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={routingMode === id ? "is-on" : ""}
              aria-pressed={routingMode === id}
              onClick={() => setRoutingMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
