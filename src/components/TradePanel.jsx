import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getAmm, getPrices, getWalletBalances, getWalletLp } from "../api/indexer";
import { useWallet } from "../context/useWallet";
import { useI18n } from "../i18n/useI18n";
import { useXamanPayload } from "../xaman/useXamanPayload";
import {
  LEDGER_FEE_XRP,
  ammDepositTx,
  ammWithdrawTx,
  expectedLpTokens,
  notifyWalletRefresh,
  offerCreateBuyXdx,
  offerCreateSellXdx,
  poolForQuote,
  quoteChoices,
  quoteIdFromPair,
  quoteTrustSetTxjson,
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
  xdxUnitUsd,
} from "../xaman/tradeTx";
import { formatPoolPct, normalizePriceBook, priceBookFromPools } from "../utils/poolSplit";
import { formatToken, formatUsd } from "../utils/format";
import { shortAddress } from "../utils/format";
import BrandSelect from "./BrandSelect";
import WalletModal from "./WalletModal";

function poolRowForQuote(pools, quote) {
  const pair = String(quote?.pair || poolForQuote(quote).pair || "").toUpperCase();
  return (Array.isArray(pools) ? pools : []).find(
    (item) => String(item.pool || item.pool_name || "").toUpperCase() === pair
  );
}

function poolReserves(pools, quote) {
  const row = poolRowForQuote(pools, quote);
  const pair = String(quote?.pair || poolForQuote(quote).pair || "XDX/XRP").toUpperCase();
  return {
    pair,
    base: Number(row?.reserve_xdx ?? row?.reserve_asset ?? 0),
    quote: Number(row?.reserve_currency ?? 0),
    lpSupply: Number(row?.lp_supply ?? 0),
    issuer: row?.quote_issuer || null,
    hex: row?.quote_hex || null,
    xdxUsd: Number(row?.xdxUsd || 0),
    quoteUsd: Number(row?.quote_usd || 0),
    quoteName: row?.quote || pair.split("/")[1] || "XRP",
    reserve_xdx: Number(row?.reserve_xdx ?? row?.reserve_asset ?? 0),
    reserve_asset: Number(row?.reserve_xdx ?? row?.reserve_asset ?? 0),
    reserve_currency: Number(row?.reserve_currency ?? 0),
  };
}

export default function TradePanel({
  action,
  initialQuote = "XRP",
  quoteExtra,
  initialPools = [],
  spotPrice = 0,
  onClose,
  onSigned,
}) {
  const { t, locale } = useI18n();
  const { walletAddress, connectWallet } = useWallet();
  const { qr, mobileUrl, uuid, status, error, start, reset } = useXamanPayload();
  const [quoteId, setQuoteId] = useState(() => quoteIdFromPair(initialQuote || "XRP"));
  const [orderType, setOrderType] = useState("market");
  const [amount, setAmount] = useState(() => (action === "addLp" || action === "removeLp" ? "" : "100000"));
  const [quoteQty, setQuoteQty] = useState("");
  const [editedSide, setEditedSide] = useState("xdx");
  const [price, setPrice] = useState(spotPrice > 0 ? String(spotPrice) : "");
  const [lpAmount, setLpAmount] = useState("");
  const [walletLp, setWalletLp] = useState([]);
  const [pools, setPools] = useState(() => (Array.isArray(initialPools) ? initialPools : []));
  const [lineHint, setLineHint] = useState("");
  const [formError, setFormError] = useState("");
  const [liveSpot, setLiveSpot] = useState(spotPrice);
  const [prices, setPrices] = useState(() => priceBookFromPools(initialPools));

  const matched = poolRowForQuote(pools, { pair: `XDX/${quoteId}` });
  const quote = useMemo(
    () =>
      resolveQuote(quoteId, {
        ...quoteExtra,
        quote_issuer: quoteExtra?.quoteIssuer || matched?.quote_issuer,
        quote_hex: quoteExtra?.quoteHex || matched?.quote_hex,
      }),
    [quoteId, quoteExtra, matched]
  );
  const quoteIssuer = quote.issuer || "";
  const quoteHex = quote.hex || "";
  const quotePair = quote.pair || "";
  const isLp = action === "addLp" || action === "removeLp";
  const signedIn = Boolean(walletAddress);
  const needTrust =
    Boolean(quote.issuer) &&
    !lineHint.includes(String(quote.currency || "").toUpperCase()) &&
    !lineHint.includes(String(quote.issuer || "").toUpperCase());
  const reserves = useMemo(() => poolReserves(pools, quote), [pools, quote]);
  const implied = poolPrice(reserves.base, reserves.quote);
  const px =
    orderType === "limit" && Number(price) > 0
      ? Number(price)
      : Number(liveSpot || spotPrice || implied || price);
  const linked = linkedDepositAmounts({
    editedSide,
    amount,
    quoteQty,
    price: px,
    reserveBase: reserves.base,
    reserveQuote: reserves.quote,
  });
  const total = tradeTotal(linked.xdx || amount, px);
  const quoteHint = predictedQuoteOut(linked.xdx || amount, px, reserves.base, reserves.quote);
  const shownAmount = linked.xdxInput;
  const shownQuoteQty = linked.quoteInput;
  const lpHint = expectedLpTokens(linked.xdx || amount, reserves.base, reserves.lpSupply);
  const xdxUsd = xdxUnitUsd({ pool: reserves, prices });
  const quoteUsd = quoteUnitUsd({ quoteId, pool: reserves, prices, allowImplied: false });
  const withdraw = expectedWithdraw(lpAmount || amount, reserves.base, reserves.quote, reserves.lpSupply);
  const typedXdx = Number(amount) || 0;
  const typedQuote = Number(quoteQty) || 0;
  const deposit = depositValueSplit({
    xdxAmount: action === "removeLp" ? withdraw.base : typedXdx,
    quoteAmount: action === "removeLp" ? withdraw.quote : typedQuote,
    xdxUsd,
    quoteUsd,
  });
  const splitReady = Boolean(deposit.measured);
  const lpHeld = lpHeldForPair(walletLp, quotePair, quoteId);
  const sides = tradeSides({
    action,
    amount: linked.xdx || amount,
    quoteQty: linked.quote || shownQuoteQty || quoteHint,
    quoteLabel: quote.label,
    total,
    lpAmount: lpAmount || amount,
    lpOut: lpHint,
    withdraw,
  });
  const titles = {
    buy: t.buyXdx,
    sell: t.sellXdx,
    addLp: t.addLiquidity,
    removeLp: t.removeLiquidity,
  };

  useEffect(() => {
    if (!action) return undefined;
    let cancelled = false;
    getPrices()
      .then((nextPrices) => {
        if (cancelled) return;
        setPrices((current) => priceBookFromPools([], { ...current, ...normalizePriceBook(nextPrices || {}) }));
        const next = Number(
          quoteId === "XRP"
            ? nextPrices.xdxXrp || nextPrices.xdxPerXrp
            : quoteId === "RLUSD"
              ? nextPrices.xdxRlusd || nextPrices.xdxUsd
              : 0
        );
        if (next > 0) {
          setLiveSpot(next);
          setPrice((current) => current || String(next));
        }
      })
      .catch(() => {});
    Promise.all([getAmm().catch(() => []), walletAddress ? getWalletLp(walletAddress).catch(() => []) : []]).then(
      ([nextPools, nextLp]) => {
        if (cancelled) return;
        setPools(Array.isArray(nextPools) ? nextPools : []);
        setPrices((current) => priceBookFromPools(nextPools, current));
        const rows = Array.isArray(nextLp) ? nextLp : [];
        setWalletLp(rows);
        if (action === "removeLp") {
          const have = lpHeldForPair(rows, quotePair, quoteId);
          if (have > 0) setLpAmount((current) => current || String(have));
        }
      }
    );
    if (walletAddress && quoteIssuer) {
      getWalletBalances(walletAddress)
        .then((balances) => {
          if (cancelled) return;
          setLineHint(JSON.stringify(balances.raw || {}).toUpperCase());
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [action, quoteHex, quoteId, quoteIssuer, quotePair, walletAddress]);

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
    if (action === "buy") {
      return offerCreateBuyXdx({
        account: walletAddress,
        quote,
        xdx: linked.xdx || amount,
        cost: linked.quote || shownQuoteQty || total,
        market: orderType === "market",
      });
    }
    if (action === "sell") {
      return offerCreateSellXdx({
        account: walletAddress,
        quote,
        xdx: linked.xdx || amount,
        proceeds: linked.quote || shownQuoteQty || total,
        market: orderType === "market",
      });
    }
    if (action === "addLp") {
      return ammDepositTx({
        account: walletAddress,
        quote,
        xdx: linked.xdx || amount,
        quoteQty: linked.quote || shownQuoteQty || quoteHint || total,
      });
    }
    return ammWithdrawTx({
      account: walletAddress,
      quote,
      lpAmount: lpAmount || amount,
    });
  }

  function signIn() {
    start({
      onSigned: (account) => connectWallet(account),
      errorMessage: t.walletError,
    });
  }

  function submit() {
    setFormError("");
    if (!signedIn) {
      signIn();
      return;
    }
    if (needTrust && quote.issuer) {
      const line = quoteTrustSetTxjson(walletAddress, quote);
      start({
        body: { txjson: line },
        onSigned: () => {
          setLineHint((current) => `${current} ${quote.currency} ${quote.issuer}`.toUpperCase());
          notifyWalletRefresh();
        },
        errorMessage: t.trustlineError,
      });
      return;
    }
    const qty = Number(action === "removeLp" ? lpAmount || amount : linked.xdx || amount);
    if (!(qty > 0)) {
      setFormError(t.tradeNeedAmount);
      return;
    }
    if (action === "addLp" && quote.currency !== "XRP" && !quote.issuer) {
      setFormError(t.tradeNeedTrustline);
      return;
    }
    if (action === "addLp" && !(linked.quote > 0)) {
      setFormError(t.tradeNeedAmount);
      return;
    }
    if (!isLp && !(px > 0)) {
      setFormError(t.tradeNeedPrice);
      return;
    }
    start({
      body: { txjson: buildTx() },
      onSigned: () => {
        notifyWalletRefresh();
      },
      onExecuted: () => {
        notifyWalletRefresh();
        onSigned?.();
        onClose();
      },
      errorMessage: t.tradeSignError,
    });
  }

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
          {titles[action] || t.tradeActions}
        </h2>
        {signedIn ? (
          <p className="trade-panel-account">{shortAddress(walletAddress)}</p>
        ) : (
          <p className="trade-panel-hint">{t.signInToTrade}</p>
        )}

        <label className="trade-field">
          {t.tradePair}
          <BrandSelect
            value={quoteId}
            options={quoteChoices(pools).map((id) => ({ id, label: `XDX / ${id}` }))}
            onChange={(id) => {
              setQuoteId(id);
              setQuoteQty("");
              setEditedSide("xdx");
            }}
            ariaLabel={t.tradePair}
            searchable
            placeholder={t.searchPair || t.tradePair}
          />
        </label>

        {!isLp ? (
          <label className="trade-field">
            {t.tradeOrderType}
            <BrandSelect
              value={orderType}
              options={[
                { id: "market", label: t.tradeMarket },
                { id: "limit", label: t.tradeLimit },
              ]}
              onChange={setOrderType}
              ariaLabel={t.tradeOrderType}
            />
          </label>
        ) : null}

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
        ) : (
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
              <span className="trade-field-usd">
                {xdxUsd > 0 && typedXdx > 0 ? formatUsd(typedXdx * xdxUsd, locale) : "—"}
              </span>
            ) : null}
          </label>
        )}
        {action === "removeLp" ? (
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
        {action !== "removeLp" ? (
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
              <span className="trade-field-usd">
                {quoteUsd > 0 && typedQuote > 0 ? formatUsd(typedQuote * quoteUsd, locale) : "—"}
              </span>
            ) : null}
          </label>
        ) : (
          <label className="trade-field">
            {quote.label}
            <input type="text" readOnly value={formatToken(withdraw.quote, locale, 6)} />
            <span className="trade-field-usd">
              {quoteUsd > 0 ? formatUsd(withdraw.quote * quoteUsd, locale) : "—"}
            </span>
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

        {needTrust && quote.issuer && signedIn ? <p className="trade-panel-hint">{t.tradeNeedTrustline}</p> : null}
        {formError ? <p className="wallet-error">{formError}</p> : null}
        {error ? <p className="wallet-error">{error}</p> : null}

        <div className="trade-panel-actions">
          <button type="button" className="connect-wallet-btn" onClick={submit}>
            {!signedIn ? t.signInToTrade : needTrust && quote.issuer ? t.xdxTrustline : t.tradeSign}
          </button>
          <button type="button" className="cancel-wallet-btn" onClick={close}>
            {t.cancel}
          </button>
        </div>
      </div>
      <WalletModal
        visible={status === "loading" || status === "waiting"}
        qrUrl={qr}
        mobileUrl={mobileUrl}
        uuid={uuid}
        status={status}
        preparingLabel={t.preparingTrade}
        scanLabel={t.scanTrade}
        onClose={reset}
      />
    </div>,
    document.body
  );
}
