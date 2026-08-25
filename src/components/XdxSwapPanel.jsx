import { useEffect, useMemo, useState } from "react";
import {
  getAmm,
  getLiveLpReserves,
  getOrderbook,
  getPrices,
  getWalletAccount,
  getWalletBalances,
  getWalletLines,
  getWalletLp,
} from "../api/indexer";
import { useWallet } from "../context/useWallet";
import { useI18n } from "../i18n/useI18n";
import { ammSpot } from "../ammCurve";
import { bookHeader, emptyOrderbook, normalizeOrderbookPair } from "../orderbook";
import { IMPACT_HIGH_PCT, IMPACT_WARN_PCT, quoteBridgeSwap, quoteSwap, saferSwapAlternatives } from "../swap/quoteSwap";
import {
  SWAP_LP_GOVERNANCE_PAIRS,
  needsSwapLpGovernance,
  swapLpGovernance,
} from "../swap/lpGovernance";
import { swapAssetOptions } from "../swap/swapAssets";
import { liveWalletAddress } from "../wallet/walletStorage";
import { walletAvailableAmounts } from "../wallet/composeWallet";
import { formatPercent, formatToken, formatUsd } from "../utils/format";
import { sanitizeQtyInput } from "../xaman/tradeTx";
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

function pickSwapRecommendation({ qty, routingMode, alternatives, noRoute }) {
  if (!(qty > 0)) return null;
  if (noRoute) {
    if (routingMode === "book") return { id: "amm", reason: "nobook", amountIn: qty };
    if (routingMode === "amm") return { id: "smart", reason: "noamm", amountIn: qty };
    return { id: "half", reason: "half", amountIn: qty / 2 };
  }
  const amm = alternatives.find((row) => row.id === "amm");
  const book = alternatives.find((row) => row.id === "book");
  const half = alternatives.find((row) => row.id === "half");
  if (routingMode !== "amm" && amm) return { id: "amm", reason: "better", amountIn: qty };
  if (routingMode !== "book" && book) return { id: "book", reason: "better", amountIn: qty };
  if (half) return { id: "half", reason: "half", amountIn: half.amountIn };
  return null;
}

function LpAccessLock({ open }) {
  return (
    <svg className="xdx-swap-gov-lock" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
      {open ? (
        <path
          fill="currentColor"
          d="M5.1 7.15V5.35a2.9 2.9 0 0 1 5.35-1.55l-1.05.85A1.55 1.55 0 0 0 6.55 5.35v1.8H12c.75 0 1.35.6 1.35 1.35v5.15c0 .75-.6 1.35-1.35 1.35H4c-.75 0-1.35-.6-1.35-1.35V8.5c0-.75.6-1.35 1.35-1.35h1.1z"
        />
      ) : (
        <path
          fill="currentColor"
          d="M5.1 7.15V5.35a2.9 2.9 0 0 1 5.8 0v1.8H12c.75 0 1.35.6 1.35 1.35v5.15c0 .75-.6 1.35-1.35 1.35H4c-.75 0-1.35-.6-1.35-1.35V8.5c0-.75.6-1.35 1.35-1.35h1.1zm1.45-1.8v1.8h2.9V5.35a1.45 1.45 0 1 0-2.9 0z"
        />
      )}
    </svg>
  );
}

function recommendationCopy(rec, t, impactText) {
  if (!rec) return "";
  if (rec.reason === "half") {
    const impact = impactText && !String(impactText).includes("—") ? impactText : "this much";
    return (t.swapRecHalf || "").replace("{impact}", impact);
  }
  if (rec.reason === "nobook") return t.swapRecNoBook;
  if (rec.reason === "noamm") return t.swapRecNoAmm;
  if (rec.id === "amm") return t.swapRecAmm;
  if (rec.id === "book") return t.swapRecBook;
  return "";
}

export default function XdxSwapPanel() {
  const { t, locale } = useI18n();
  const { walletAddress } = useWallet();
  const account = liveWalletAddress(walletAddress);
  const [fromId, setFromId] = useState("XDX");
  const [toId, setToId] = useState("XRP");
  const [amount, setAmount] = useState("");
  const [routingMode, setRoutingMode] = useState("smart");
  const [acceptedRecKey, setAcceptedRecKey] = useState("");
  const [lines, setLines] = useState([]);
  const [balances, setBalances] = useState({});
  const [walletAccount, setWalletAccount] = useState({});
  const [pools, setPools] = useState([]);
  const [markets, setMarkets] = useState({});
  const [prices, setPrices] = useState({});
  const [positions, setPositions] = useState([]);
  const [liveByPair, setLiveByPair] = useState({});
  const [checking, setChecking] = useState(false);

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
  const needsGate = needsSwapLpGovernance(fromTicker, toTicker);
  const fromPair = fromTicker === "XDX" ? null : normalizeOrderbookPair(`XDX/${fromTicker}`);
  const toPair = toTicker === "XDX" ? null : normalizeOrderbookPair(`XDX/${toTicker}`);
  const pair = needsGate ? `${fromTicker} → ${toTicker}` : `XDX/${sellingXdx ? toTicker : fromTicker}`;
  const marketKey = [fromPair, toPair].filter(Boolean).join("|");
  const gate = swapLpGovernance({
    positions,
    lines,
    pools,
    liveByPair,
    prices,
  });

  useEffect(() => {
    let cancelled = false;
    async function loadWallet() {
      if (!account) {
        setLines([]);
        setBalances({});
        setWalletAccount({});
        setPositions([]);
        return;
      }
      const [nextLines, nextBal, nextAccount, nextLp] = await Promise.all([
        getWalletLines(account, { fresh: true }).catch(() => []),
        getWalletBalances(account).catch(() => ({})),
        getWalletAccount(account).catch(() => ({})),
        getWalletLp(account, { fresh: true }).catch(() => []),
      ]);
      if (cancelled) return;
      setLines(Array.isArray(nextLines) ? nextLines : nextLines?.lines || []);
      setBalances(nextBal || {});
      setWalletAccount(nextAccount || {});
      setPositions(Array.isArray(nextLp) ? nextLp : []);
    }
    loadWallet();
    window.addEventListener("dpmf-wallet-refresh", loadWallet);
    return () => {
      cancelled = true;
      window.removeEventListener("dpmf-wallet-refresh", loadWallet);
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
            getLiveLpReserves({ pair: nextPair, fresh: true }).catch(() => null),
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

  useEffect(() => {
    let cancelled = false;
    async function loadGovPools() {
      const lives = await Promise.all(
        SWAP_LP_GOVERNANCE_PAIRS.map((nextPair) =>
          getLiveLpReserves({ pair: nextPair, fresh: true }).catch(() => null)
        )
      );
      if (cancelled) return;
      setLiveByPair(Object.fromEntries(SWAP_LP_GOVERNANCE_PAIRS.map((nextPair, index) => [nextPair, lives[index]])));
    }
    loadGovPools();
    const id = setInterval(loadGovPools, 30000);
    window.addEventListener("dpmf-wallet-refresh", loadGovPools);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("dpmf-wallet-refresh", loadGovPools);
    };
  }, [account]);

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
  const gatedOut = Boolean(needsGate && (!account || !gate.ok));
  const recommendation = pickSwapRecommendation({ qty, routingMode, alternatives, noRoute });
  const recKey = recommendation ? `${routingMode}:${qty}:${recommendation.id}:${recommendation.reason}` : "";
  const showRecommendation = Boolean(recommendation && recKey !== acceptedRecKey);
  const routeHelp =
    routingMode === "amm" ? t.swapHelpAmm : routingMode === "book" ? t.swapHelpBook : t.swapHelpSmart;
  const recText = recommendationCopy(
    recommendation,
    t,
    quote?.priceImpactPercent != null ? formatPercent(quote.priceImpactPercent, locale) : ""
  );
  const routeChoices = [
    ["smart", t.swapRadioSmart || t.swapSmart, t.swapRadioSmartMeta || t.swapChipSmart],
    ["book", t.swapRadioBook || t.swapRouteBook, t.swapRadioBookMeta || t.swapChipBook],
    ["amm", t.swapRadioAmm || t.swapRouteAmm, t.swapRadioAmmMeta || t.swapChipAmm],
  ];

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

  async function refreshGate() {
    if (!account) return swapLpGovernance({});
    const [nextLp, nextLines, nextPools, nextPrices, ...lives] = await Promise.all([
      getWalletLp(account, { fresh: true }).catch(() => []),
      getWalletLines(account, { fresh: true }).catch(() => []),
      getAmm().catch(() => []),
      getPrices().catch(() => ({})),
      ...SWAP_LP_GOVERNANCE_PAIRS.map((nextPair) =>
        getLiveLpReserves({ pair: nextPair, fresh: true }).catch(() => null)
      ),
    ]);
    const nextLive = Object.fromEntries(SWAP_LP_GOVERNANCE_PAIRS.map((nextPair, index) => [nextPair, lives[index]]));
    setPositions(Array.isArray(nextLp) ? nextLp : []);
    setLines(Array.isArray(nextLines) ? nextLines : nextLines?.lines || []);
    setPools(Array.isArray(nextPools) ? nextPools : nextPools?.pools || []);
    setPrices(nextPrices || {});
    setLiveByPair(nextLive);
    return swapLpGovernance({
      positions: Array.isArray(nextLp) ? nextLp : [],
      lines: Array.isArray(nextLines) ? nextLines : nextLines?.lines || [],
      pools: Array.isArray(nextPools) ? nextPools : nextPools?.pools || [],
      liveByPair: nextLive,
      prices: nextPrices || {},
    });
  }

  async function openSwap(nextAmount = qty, nextMode = routingMode) {
    const next = swapDetail(nextAmount, nextMode);
    if (needsGate) {
      setChecking(true);
      try {
        const check = await refreshGate();
        if (!check.ok) return;
      } finally {
        setChecking(false);
      }
    }
    window.dispatchEvent(new CustomEvent("dpmf-open-trade", { detail: next }));
  }

  const fromSelect = (
    <BrandSelect
      value={effectiveFrom}
      options={assets}
      onChange={changeFrom}
      ariaLabel={t.swapStart || "Start swap"}
      searchable
    />
  );
  const toSelect = (
    <BrandSelect
      value={effectiveTo}
      options={assets}
      onChange={changeTo}
      ariaLabel={t.swapFor || "For"}
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
  const swapLocked = noRoute || !(qty > 0) || gatedOut || checking;

  return (
    <section className="xdx-swap" aria-label={t.swapTitle}>
      <div className="xdx-swap-layout">
        <div className="xdx-swap-main">
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

            <div className="xdx-swap-pair-picks">
              <div className="xdx-swap-leg">
                <span>{t.swapStart || "Start swap"}</span>
                {fromSelect}
              </div>
              <div className="xdx-swap-leg">
                <span>{t.swapFor || "For"}</span>
                {toSelect}
              </div>
            </div>

            <input
              type="text"
              inputMode="decimal"
              className="xdx-swap-input is-amount"
              value={amount}
              placeholder="0"
              aria-label={t.swapAmount}
              onChange={(event) => setAmount(sanitizeQtyInput(event.target.value))}
            />
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

            <div className="xdx-swap-receive-block">
              <span>{t.swapReceive || "Receive"}</span>
              <p className="xdx-swap-out">
                {gotFill ? formatToken(quote.actualOutput, locale, sellingXdx ? 4 : 2) : "-"}
              </p>
              <small>
                {t.swapReceiveHint || "total tokens"}
                {toTicker ? ` · ${toTicker}` : ""}
              </small>
              {gotFill ? (
                <dl className="xdx-swap-venues">
                  <div>
                    <dt>{t.swapFromBook || "Order book"}</dt>
                    <dd>
                      {formatToken(quote.bookOutput || 0, locale, sellingXdx ? 4 : 2)}
                      {toTicker ? ` ${toTicker}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.swapFromAmm || "AMM"}</dt>
                    <dd>
                      {formatToken(quote.ammOutput || 0, locale, sellingXdx ? 4 : 2)}
                      {toTicker ? ` ${toTicker}` : ""}
                    </dd>
                  </div>
                </dl>
              ) : null}
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
          {needsGate && gatedOut ? <p className="xdx-swap-warn">{t.swapLpGateNeed}</p> : null}

          <div className="xdx-swap-foot">
            <button
              type="button"
              className="connect-wallet-btn"
              disabled={swapLocked}
              onClick={() => {
                void openSwap();
              }}
            >
              {account ? (checking ? t.swapLpChecking : t.swapAction) : t.swapConnect}
            </button>
          </div>
        </div>

        <aside className="xdx-swap-guide" aria-label={t.swapRouting}>
          <div className="xdx-swap-radios" role="radiogroup" aria-label={t.swapRouting}>
            {routeChoices.map(([id, label, meta]) => {
              const on = routingMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  className={on ? "is-on" : ""}
                  aria-checked={on}
                  onClick={() => setRoutingMode(id)}
                >
                  <span className="xdx-swap-radio-mark" aria-hidden="true" />
                  <span className="xdx-swap-radio-copy">
                    <b>{label}</b>
                    <small>{meta}</small>
                  </span>
                </button>
              );
            })}
          </div>

          <div key={routingMode} className="xdx-swap-tip">
            <div className="xdx-swap-tip-scan" aria-hidden="true" />
            <p className="xdx-swap-tip-kicker">{t.swapTipTitle}</p>
            <p>{routeHelp}</p>
          </div>

          {showRecommendation ? (
            <div key={recKey} className="xdx-swap-rec">
              <div className="xdx-swap-tip-scan" aria-hidden="true" />
              <p className="xdx-swap-tip-kicker">{t.swapRecTitle}</p>
              <p>{recText}</p>
              <button
                type="button"
                className="xdx-swap-rec-accept"
                onClick={() => {
                  if (recommendation.id === "half") setAmount(String(recommendation.amountIn));
                  if (recommendation.id === "amm" || recommendation.id === "book" || recommendation.id === "smart") {
                    setRoutingMode(recommendation.id);
                  }
                  setAcceptedRecKey(recKey);
                }}
              >
                {t.swapRecAccept}
              </button>
            </div>
          ) : null}
        </aside>

        <aside className="xdx-swap-gov" aria-label={t.swapLpGateTitle}>
          <h4>{t.swapLpGateTitle}</h4>
          <p>{t.swapLpGateHint}</p>
          <p className={`xdx-swap-gov-status${gate.ok ? " is-yes" : " is-no"}`}>
            <LpAccessLock open={gate.ok} />
            {gate.ok ? t.swapLpGateOpen : t.swapLpGateClosed}
          </p>
          <ul>
            {gate.rows.map((row) => (
              <li key={row.pair} className={row.ok ? "is-yes" : ""}>
                <span>{row.pair}</span>
                <b>
                  {formatUsd(row.usd, locale)} / {formatUsd(row.threshold, locale)}
                </b>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
