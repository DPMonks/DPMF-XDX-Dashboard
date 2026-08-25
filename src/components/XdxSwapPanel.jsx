import { useEffect, useMemo, useState } from "react";
import { getAmm, getLiveLpReserves, getOrderbook, getWalletAccount, getWalletBalances, getWalletLines } from "../api/indexer";
import { useWallet } from "../context/useWallet";
import { useI18n } from "../i18n/useI18n";
import { ammSpot } from "../ammCurve";
import { bookHeader, emptyOrderbook, normalizeOrderbookPair } from "../orderbook";
import { IMPACT_HIGH_PCT, IMPACT_WARN_PCT, quoteSwap, saferSwapAlternatives } from "../swap/quoteSwap";
import { swapCounterOptions } from "../swap/swapAssets";
import { liveWalletAddress } from "../wallet/walletStorage";
import { walletAvailableAmounts } from "../wallet/composeWallet";
import { formatPercent, formatToken } from "../utils/format";
import { sanitizeQtyInput } from "../xaman/tradeTx";
import BrandSelect from "./BrandSelect";

const SWAP_PCTS = [25, 50, 75, 100];

function amountAtPercent(available, pct) {
  const hold = Number(available) * (Number(pct) / 100);
  if (!(hold > 0)) return "";
  const text = hold >= 1_000_000 ? String(Math.round(hold)) : hold.toPrecision(8);
  return String(Number(/[eE]/.test(text) ? hold.toFixed(8) : text));
}

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

function LockedXdx({ label }) {
  return (
    <p className="xdx-swap-lock">
      <span>{label}</span>
      <b>XDX</b>
    </p>
  );
}

export default function XdxSwapPanel() {
  const { t, locale } = useI18n();
  const { walletAddress } = useWallet();
  const account = liveWalletAddress(walletAddress);
  const [sellingXdx, setSellingXdx] = useState(true);
  const [quoteId, setQuoteId] = useState("XRP");
  const [amount, setAmount] = useState("");
  const [routingMode, setRoutingMode] = useState("smart");
  const [lines, setLines] = useState([]);
  const [balances, setBalances] = useState({});
  const [walletAccount, setWalletAccount] = useState({});
  const [pools, setPools] = useState([]);
  const [book, setBook] = useState(null);
  const [live, setLive] = useState(null);

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
    () => swapCounterOptions({ pools, lines, balances: { xdx: balances.xdx, xrp: balances.xrp } }),
    [pools, lines, balances]
  );
  const quoteAsset = options.find((row) => row.id === quoteId) || options.find((row) => row.id === "XRP") || options[0];
  const hold = walletAvailableAmounts({
    balances,
    account: walletAccount,
    lines,
    quote: quoteId === "XRP" ? { currency: "XRP" } : quoteAsset,
  });
  const available = sellingXdx ? hold.xdx : quoteId === "XRP" ? hold.xrp : hold.quote;
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

  function changeQuote(id) {
    const next = String(id || "").toUpperCase();
    if (!next || next === "XDX") return;
    setQuoteId(next);
  }

  function openSwap(nextAmount = qty, nextMode = routingMode) {
    window.dispatchEvent(
      new CustomEvent("dpmf-open-trade", {
        detail: {
          action: sellingXdx ? "sell" : "buy",
          quote: quoteId,
          quoteIssuer: quoteAsset?.issuer,
          quoteHex: quoteAsset?.hex,
          amount: sellingXdx ? nextAmount : quote?.actualOutput,
          routingMode: nextMode,
        },
      })
    );
  }

  const counterSelect = (
    <BrandSelect
      value={quoteAsset?.id || quoteId}
      options={options}
      onChange={changeQuote}
      ariaLabel={sellingXdx ? t.swapTo : t.swapFrom}
      searchable
    />
  );

  return (
    <section className="xdx-swap" aria-label={t.swapTitle}>
      <div className="xdx-swap-head">
        <h3 className="orderbook-title">{t.swapTitle}</h3>
        <p className="xdx-swap-pair">{pair}</p>
      </div>

      <div className="xdx-swap-dirs" role="tablist" aria-label={t.swapTitle}>
        <button
          type="button"
          role="tab"
          aria-selected={sellingXdx}
          className={sellingXdx ? "pair-chip active" : "pair-chip"}
          onClick={() => setSellingXdx(true)}
        >
          {t.swapSellXdx}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!sellingXdx}
          className={!sellingXdx ? "pair-chip active" : "pair-chip"}
          onClick={() => setSellingXdx(false)}
        >
          {t.swapBuyXdx}
        </button>
      </div>

      <div className="xdx-swap-legs">
        <div className={`xdx-swap-leg${sellingXdx ? " is-xdx" : ""}`}>
          <span>{t.swapFrom}</span>
          {sellingXdx ? <LockedXdx label={t.swapLockedXdx} /> : counterSelect}
          <input
            type="text"
            inputMode="decimal"
            className="xdx-swap-input"
            value={amount}
            placeholder="0"
            aria-label={t.swapAmount}
            onChange={(event) => setAmount(sanitizeQtyInput(event.target.value))}
          />
          <p className="xdx-swap-hold">
            {account && available != null ? formatToken(available, locale, sellingXdx ? 2 : 4) : "—"}
          </p>
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
        </div>

        <button type="button" className="xdx-swap-flip" onClick={() => setSellingXdx((on) => !on)} aria-label={t.swapFlip}>
          ⇄
        </button>

        <div className={`xdx-swap-leg${!sellingXdx ? " is-xdx" : ""}`}>
          <span>{t.swapTo}</span>
          {sellingXdx ? counterSelect : <LockedXdx label={t.swapLockedXdx} />}
          <p className="xdx-swap-out">{quote ? formatToken(quote.actualOutput, locale, sellingXdx ? 4 : 2) : "—"}</p>
          <small>{t.swapActual}</small>
        </div>
      </div>

      <dl className="xdx-swap-stats">
        <div>
          <dt>{t.swapExpected}</dt>
          <dd>{quote ? formatToken(quote.expectedOutput, locale, 4) : "—"}</dd>
        </div>
        <div>
          <dt>{t.swapSlippage}</dt>
          <dd className={quote?.isNegativeSlippage ? "is-warn" : ""}>
            {quote ? formatPercent(quote.slippagePercent, locale) : "—"}
          </dd>
        </div>
        <div>
          <dt>{t.swapImpact}</dt>
          <dd className={impactHot ? "is-warn" : ""}>
            {quote ? formatPercent(quote.priceImpactPercent, locale) : "—"}
          </dd>
        </div>
        <div>
          <dt>{t.swapRoute}</dt>
          <dd>{t[ROUTES[quote?.routeUsed] || "swapRouteNone"] || quote?.routeUsed || "—"}</dd>
        </div>
      </dl>

      {noRoute ? <p className="xdx-swap-warn">{t.swapNoRoute}</p> : null}
      {quote?.isNegativeSlippage ? (
        <p className="xdx-swap-warn">
          {t.swapNegative.replace("{amount}", formatToken(quote.lossAmount, locale, 4))}
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
              {row.id === "half" ? t.swapSaferHalf : row.id === "amm" ? t.swapSaferAmm : t.swapSaferBook}
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
