import { useEffect, useMemo, useState } from "react";
import { getAmm, getLiveLpReserves, getOrderbook, getWalletAccount, getWalletBalances, getWalletLines } from "../api/indexer";
import { useWallet } from "../context/useWallet";
import { useI18n } from "../i18n/useI18n";
import { ammSpot } from "../ammCurve";
import { bookHeader, emptyOrderbook, normalizeOrderbookPair } from "../orderbook";
import { IMPACT_HIGH_PCT, IMPACT_WARN_PCT, quoteSwap, saferSwapAlternatives } from "../swap/quoteSwap";
import { pickOtherAsset, swapAssetOptions, swapCounterAsset, swapSellingXdx } from "../swap/swapAssets";
import { liveWalletAddress } from "../wallet/walletStorage";
import { walletAvailableAmounts } from "../wallet/composeWallet";
import { formatPercent, formatToken } from "../utils/format";
import { sanitizeQtyInput } from "../xaman/tradeTx";
import BrandSelect from "./BrandSelect";

const ROUTES = {
  hybrid: "swapRouteHybrid",
  amm: "swapRouteAmm",
  book: "swapRouteBook",
  none: "swapRouteNone",
};

function reserveFrom(book, live) {
  return {
    reserveBase: Number(live?.reserve_xdx ?? live?.reserve_asset ?? book?.amm?.reserve_asset ?? 0),
    reserveQuote: Number(live?.reserve_currency ?? live?.reserve_quote ?? book?.amm?.reserve_currency ?? 0),
    tradingFee: Number(live?.trading_fee ?? book?.amm?.trading_fee ?? 1000),
  };
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
  const [book, setBook] = useState(null);
  const [live, setLive] = useState(null);

  const sellingXdx = swapSellingXdx(fromId);
  const quoteId = swapCounterAsset(fromId, toId);
  const pair = normalizeOrderbookPair(`XDX/${quoteId || "XRP"}`);

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
      const [nextPools, nextBook, nextLive] = await Promise.all([
        getAmm().catch(() => []),
        getOrderbook(pair).catch(() => null),
        getLiveLpReserves({ pair }).catch(() => null),
      ]);
      if (cancelled) return;
      setPools(Array.isArray(nextPools) ? nextPools : nextPools?.pools || []);
      setBook(nextBook || emptyOrderbook(pair));
      setLive(nextLive);
    }
    loadMarket();
    const id = setInterval(loadMarket, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pair]);

  const options = useMemo(
    () => swapAssetOptions({ pools, lines, balances: { xdx: balances.xdx, xrp: balances.xrp } }),
    [pools, lines, balances]
  );
  const fromOptions = options.filter((row) => row.id !== toId);
  const toOptions = options.filter((row) => row.id !== fromId);
  const fromAsset = options.find((row) => row.id === fromId) || options[0];
  const toAsset = options.find((row) => row.id === toId) || options.find((row) => row.id === "XRP");
  const hold = walletAvailableAmounts({
    balances,
    account: walletAccount,
    lines,
    quote: fromId === "XRP" ? { currency: "XRP" } : fromAsset,
  });
  const available = sellingXdx ? hold.xdx : fromId === "XRP" ? hold.xrp : hold.quote;
  const header = bookHeader(book || emptyOrderbook(pair));
  const reserves = reserveFrom(book, live);
  const qty = Number(amount) || 0;
  const mid = header.mid || ammSpot(reserves.reserveBase, reserves.reserveQuote);
  const extras = {
    sellingXdx,
    mid,
    bids: book?.bids || [],
    asks: book?.asks || [],
    reserveBase: reserves.reserveBase,
    reserveQuote: reserves.reserveQuote,
    tradingFee: reserves.tradingFee,
  };
  const quote = qty > 0 ? quoteSwap({ ...extras, amountIn: qty, routingMode }) : null;
  const alternatives = quote ? saferSwapAlternatives(qty, quote, extras) : [];
  const impactHot =
    quote && (Math.abs(quote.priceImpactPercent) >= IMPACT_WARN_PCT || quote.isNegativeSlippage);
  const impactHigh = quote && Math.abs(quote.priceImpactPercent) >= IMPACT_HIGH_PCT;
  const noRoute = Boolean(qty > 0 && (!quote || quote.routeUsed === "none" || !(quote.actualOutput > 0)));

  function changeFrom(id) {
    const next = String(id || "").toUpperCase();
    setFromId(next);
    if (next !== "XDX" && toId !== "XDX") setToId("XDX");
    if (next === "XDX" && toId === "XDX") setToId(pickOtherAsset(next, "XRP"));
  }

  function changeTo(id) {
    const next = String(id || "").toUpperCase();
    setToId(next);
    if (next !== "XDX" && fromId !== "XDX") setFromId("XDX");
    if (next === "XDX" && fromId === "XDX") setFromId(pickOtherAsset(next, "XRP"));
  }

  function flip() {
    setFromId(toId);
    setToId(fromId);
  }

  function openSwap(nextAmount = qty, nextMode = routingMode) {
    const other = options.find((row) => row.id === quoteId) || toAsset || fromAsset;
    window.dispatchEvent(
      new CustomEvent("dpmf-open-trade", {
        detail: {
          action: sellingXdx ? "sell" : "buy",
          quote: quoteId,
          quoteIssuer: other?.issuer,
          quoteHex: other?.hex,
          amount: sellingXdx ? nextAmount : quote?.actualOutput,
          routingMode: nextMode,
        },
      })
    );
  }

  return (
    <section className="xdx-swap" aria-label={t.swapTitle || "Swap"}>
      <div className="xdx-swap-head">
        <h3 className="orderbook-title">{t.swapTitle || "Swap"}</h3>
        <p className="xdx-swap-pair">{pair}</p>
      </div>

      <div className="xdx-swap-legs">
        <label className="xdx-swap-leg">
          <span>{t.swapFrom || "From"}</span>
          <BrandSelect
            value={fromId}
            options={fromOptions}
            onChange={changeFrom}
            ariaLabel={t.swapFrom || "From"}
            searchable
          />
          <input
            type="text"
            inputMode="decimal"
            className="xdx-swap-input"
            value={amount}
            placeholder="0"
            aria-label={t.swapAmount || "Amount"}
            onChange={(event) => setAmount(sanitizeQtyInput(event.target.value))}
          />
          <button type="button" className="xdx-swap-max" disabled={!account || !(available > 0)} onClick={() => setAmount(String(available))}>
            {t.swapMax || "Max"}
            {account && available != null ? ` ${formatToken(available, locale, sellingXdx ? 2 : 4)}` : ""}
          </button>
        </label>

        <button type="button" className="xdx-swap-flip" onClick={flip} aria-label={t.swapFlip || "Flip"}>
          ⇄
        </button>

        <label className="xdx-swap-leg">
          <span>{t.swapTo || "To"}</span>
          <BrandSelect
            value={toId}
            options={toOptions}
            onChange={changeTo}
            ariaLabel={t.swapTo || "To"}
            searchable
          />
          <p className="xdx-swap-out">{quote ? formatToken(quote.actualOutput, locale, sellingXdx ? 4 : 2) : "—"}</p>
          <small>{t.swapActual || "You receive"}</small>
        </label>
      </div>

      <dl className="xdx-swap-stats">
        <div>
          <dt>{t.swapExpected || "Expected"}</dt>
          <dd>{quote ? formatToken(quote.expectedOutput, locale, 4) : "—"}</dd>
        </div>
        <div>
          <dt>{t.swapSlippage || "Slippage"}</dt>
          <dd className={quote?.isNegativeSlippage ? "is-warn" : ""}>
            {quote ? formatPercent(quote.slippagePercent, locale) : "—"}
          </dd>
        </div>
        <div>
          <dt>{t.swapImpact || "Price impact"}</dt>
          <dd className={impactHot ? "is-warn" : ""}>
            {quote ? formatPercent(quote.priceImpactPercent, locale) : "—"}
          </dd>
        </div>
        <div>
          <dt>{t.swapRoute || "Route"}</dt>
          <dd>{t[ROUTES[quote?.routeUsed] || "swapRouteNone"] || quote?.routeUsed || "—"}</dd>
        </div>
      </dl>

      {noRoute ? <p className="xdx-swap-warn">{t.swapNoRoute}</p> : null}
      {quote?.isNegativeSlippage ? (
        <p className="xdx-swap-warn">
          {(t.swapNegative || "This size is below mid. You would leave {amount} on the table.").replace(
            "{amount}",
            formatToken(quote.lossAmount, locale, 4)
          )}
        </p>
      ) : null}
      {impactHigh ? <p className="xdx-swap-warn">{t.swapImpactHigh}</p> : null}

      {alternatives.length ? (
        <div className="xdx-swap-alts">
          <p>{t.swapSafer}</p>
          {alternatives.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                if (row.id === "half") setAmount(String(row.amountIn));
                if (row.id === "amm" || row.id === "book") setRoutingMode(row.id);
              }}
            >
              {row.id === "half"
                ? t.swapSaferHalf
                : row.id === "amm"
                  ? t.swapSaferAmm
                  : t.swapSaferBook}
            </button>
          ))}
        </div>
      ) : null}

      <fieldset className="xdx-swap-advanced">
        <legend>{t.swapRouting}</legend>
        <div className="xdx-swap-routes">
          {[
            ["smart", t.swapSmart],
            ["amm", t.swapRouteAmm],
            ["book", t.swapRouteBook],
          ].map(([id, label]) => (
            <label key={id}>
              <input
                type="radio"
                name="xdx-swap-route"
                checked={routingMode === id}
                onChange={() => setRoutingMode(id)}
              />
              {label}
            </label>
          ))}
        </div>
        <p className="xdx-swap-help">
          {routingMode === "amm" ? t.swapHelpAmm : routingMode === "book" ? t.swapHelpBook : t.swapHelpSmart}
        </p>
      </fieldset>

      <div className="xdx-swap-actions">
        <button
          type="button"
          className="connect-wallet-btn"
          disabled={noRoute || !(qty > 0)}
          onClick={() => openSwap()}
        >
          {account ? t.swapAction : t.swapConnect}
        </button>
      </div>
    </section>
  );
}
