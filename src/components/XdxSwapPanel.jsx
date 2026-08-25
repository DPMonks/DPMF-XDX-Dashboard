import { useEffect, useMemo, useState } from "react";
import { getAmm, getLiveLpReserves, getOrderbook, getWalletAccount, getWalletBalances, getWalletLines } from "../api/indexer";
import { useWallet } from "../context/useWallet";
import { useI18n } from "../i18n/useI18n";
import { ammSpot } from "../ammCurve";
import { bookHeader, emptyOrderbook, normalizeOrderbookPair } from "../orderbook";
import { IMPACT_WARN_PCT, quoteSwap, saferSwapAlternatives } from "../swap/quoteSwap";
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

function reserveFrom(book, live) {
  return {
    reserveBase: Number(live?.reserve_xdx ?? live?.reserve_asset ?? book?.amm?.reserve_asset ?? 0),
    reserveQuote: Number(live?.reserve_currency ?? live?.reserve_quote ?? book?.amm?.reserve_currency ?? 0),
    tradingFee: Number(live?.trading_fee ?? book?.amm?.trading_fee ?? 1000),
  };
}

function TokenMark({ id }) {
  return <b className="xdx-swap-token">{id}</b>;
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

  const options = useMemo(
    () =>
      swapCounterOptions({
        pools,
        lines,
        balances: { xdx: balances.xdx, xrp: balances.xrp },
        signedIn: Boolean(account),
      }),
    [account, balances, lines, pools]
  );
  const quoteAsset = options.find((row) => row.id === quoteId) || options.find((row) => row.id === "XRP") || options[0];
  const effectiveQuoteId = quoteAsset?.id || "XRP";
  const pair = normalizeOrderbookPair(`XDX/${effectiveQuoteId}`);

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

  const hold = walletAvailableAmounts({
    balances,
    account: walletAccount,
    lines,
    quote: effectiveQuoteId === "XRP" ? { currency: "XRP" } : quoteAsset,
  });
  const available = sellingXdx ? hold.xdx : effectiveQuoteId === "XRP" ? hold.xrp : hold.quote;
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
          quote: effectiveQuoteId,
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
      value={effectiveQuoteId}
      options={options}
      onChange={changeQuote}
      ariaLabel={sellingXdx ? t.swapGet : t.swapPay}
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
        : t.swapSmart
    : "";

  return (
    <section className="xdx-swap" aria-label={t.swapTitle}>
      <div className="xdx-swap-head">
        <h3 className="orderbook-title">{t.swapTitle}</h3>
        <p className="xdx-swap-pair">{pair}</p>
      </div>

      <div className="xdx-swap-box">
        <div className="xdx-swap-modes" role="group" aria-label={t.swapDirection}>
          <button type="button" className={!sellingXdx ? "is-on is-buy" : ""} aria-pressed={!sellingXdx} onClick={() => setSellingXdx(false)}>
            {t.swapBuyXdx}
          </button>
          <button type="button" className={sellingXdx ? "is-on is-sell" : ""} aria-pressed={sellingXdx} onClick={() => setSellingXdx(true)}>
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
          {sellingXdx ? <TokenMark id="XDX" /> : counterSelect}
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
          <p className="xdx-swap-out">{gotFill ? formatToken(quote.actualOutput, locale, sellingXdx ? 4 : 2) : "—"}</p>
          {sellingXdx ? counterSelect : <TokenMark id="XDX" />}
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
        <button
          type="button"
          className="connect-wallet-btn"
          disabled={noRoute || !(qty > 0)}
          onClick={() => openSwap()}
        >
          {account ? t.swapAction : t.swapConnect}
        </button>
        <div className="xdx-swap-routes" role="radiogroup" aria-label={t.swapRouting}>
          {[
            ["smart", t.swapSmart],
            ["amm", t.swapRoutePool || "Pool"],
            ["book", t.swapBook || "Book"],
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
