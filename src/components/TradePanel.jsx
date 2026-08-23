import { useEffect, useMemo, useState } from "react";
import { getAmm, getPrices, getWalletBalances, getWalletLp } from "../api/indexer";
import { useWallet } from "../context/useWallet";
import { useI18n } from "../i18n/useI18n";
import { useXamanPayload } from "../xaman/useXamanPayload";
import {
  LEDGER_FEE_XRP,
  QUOTE_ASSETS,
  ammDepositTx,
  ammWithdrawTx,
  expectedLpTokens,
  notifyWalletRefresh,
  offerCreateBuyXdx,
  offerCreateSellXdx,
  poolForQuote,
  quoteAsset,
  quoteTrustSetTxjson,
  recommendedQuote,
  tradeTotal,
} from "../xaman/tradeTx";
import { formatToken } from "../utils/format";
import { shortAddress } from "../utils/format";
import WalletModal from "./WalletModal";

function poolReserves(pools, quote) {
  const pair = poolForQuote(quote).pair;
  const row = (Array.isArray(pools) ? pools : []).find(
    (item) => String(item.pool || item.pool_name || "").toUpperCase() === pair
  );
  return {
    pair,
    base: Number(row?.reserve_xdx ?? row?.reserve_asset ?? 0),
    quote: Number(row?.reserve_currency ?? 0),
    lpSupply: Number(row?.lp_supply ?? 0),
  };
}

export default function TradePanel({
  action,
  spotPrice = 0,
  onClose,
  onSigned,
}) {
  const { t, locale } = useI18n();
  const { walletAddress, connectWallet } = useWallet();
  const { qr, mobileUrl, uuid, status, error, start, reset } = useXamanPayload();
  const [quoteId, setQuoteId] = useState("XRP");
  const [orderType, setOrderType] = useState("market");
  const [amount, setAmount] = useState("100000");
  const [price, setPrice] = useState(spotPrice > 0 ? String(spotPrice) : "");
  const [lpAmount, setLpAmount] = useState("");
  const [pools, setPools] = useState([]);
  const [lineHint, setLineHint] = useState("");
  const [formError, setFormError] = useState("");
  const [liveSpot, setLiveSpot] = useState(spotPrice);

  const quote = quoteAsset(quoteId);
  const isLp = action === "addLp" || action === "removeLp";
  const signedIn = Boolean(walletAddress);
  const needTrust =
    Boolean(quote.issuer) &&
    !lineHint.includes(String(quote.currency || "").toUpperCase()) &&
    !lineHint.includes(String(quote.issuer || "").toUpperCase());
  const px =
    orderType === "market" && Number(liveSpot || spotPrice) > 0 ? Number(liveSpot || spotPrice) : Number(price);
  const total = tradeTotal(amount, px);
  const reserves = useMemo(() => poolReserves(pools, quote), [pools, quote]);
  const quoteHint = recommendedQuote(amount, reserves.base, reserves.quote);
  const lpHint = expectedLpTokens(amount, reserves.base, reserves.lpSupply);
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
      .then((prices) => {
        if (cancelled) return;
        const next = Number(quoteId === "XRP" ? prices.xdxXrp || prices.xdxPerXrp : prices.xdxRlusd || prices.xdxUsd);
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
        if (action === "removeLp") {
          const pair = poolForQuote(quote).pair;
          const row = (Array.isArray(nextLp) ? nextLp : []).find(
            (item) => String(item.pool_name || item.pool || "").toUpperCase() === pair
          );
          const have = Number(row?.lp_balance ?? row?.lp ?? 0);
          if (have > 0) setLpAmount(String(have));
        }
      }
    );
    if (walletAddress && quote.issuer) {
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
  }, [action, quote, quoteId, walletAddress]);

  function buildTx() {
    if (action === "buy") {
      return offerCreateBuyXdx({
        account: walletAddress,
        quote,
        xdx: amount,
        cost: total,
        market: orderType === "market",
      });
    }
    if (action === "sell") {
      return offerCreateSellXdx({
        account: walletAddress,
        quote,
        xdx: amount,
        proceeds: total,
        market: orderType === "market",
      });
    }
    if (action === "addLp") {
      return ammDepositTx({
        account: walletAddress,
        quote,
        xdx: amount,
        quoteQty: quoteHint || total,
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
    const qty = Number(action === "removeLp" ? lpAmount || amount : amount);
    if (!(qty > 0)) {
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
        onSigned?.();
        onClose();
      },
      errorMessage: t.tradeSignError,
    });
  }

  if (!action) return null;

  return (
    <div className="wallet-modal-overlay" onClick={onClose}>
      <div
        className="wallet-modal trade-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-panel-title"
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
          <select value={quoteId} onChange={(event) => setQuoteId(event.target.value)}>
            {QUOTE_ASSETS.map((row) => (
              <option key={row.id} value={row.id}>
                XDX / {row.label}
              </option>
            ))}
          </select>
        </label>

        {!isLp ? (
          <label className="trade-field">
            {t.tradeOrderType}
            <select value={orderType} onChange={(event) => setOrderType(event.target.value)}>
              <option value="market">{t.tradeMarket}</option>
              <option value="limit">{t.tradeLimit}</option>
            </select>
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
          </label>
        ) : (
          <label className="trade-field">
            {t.xdxAmount}
            <input type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
        )}

        {!isLp && orderType === "limit" ? (
          <label className="trade-field">
            {t.tradePrice} ({quote.label})
            <input type="number" min="0" step="any" value={price} onChange={(event) => setPrice(event.target.value)} />
          </label>
        ) : null}

        <dl className="trade-summary">
          {!isLp ? (
            <div>
              <dt>{action === "buy" ? t.tradeCost : t.tradeProceeds}</dt>
              <dd>
                {formatToken(total, locale, 6)} {quote.label}
              </dd>
            </div>
          ) : null}
          {action === "addLp" ? (
            <>
              <div>
                <dt>{t.tradeAlsoAdd}</dt>
                <dd>
                  {formatToken(quoteHint, locale, 6)} {quote.label}
                </dd>
              </div>
              <div>
                <dt>{t.tradeExpectedLp}</dt>
                <dd>{formatToken(lpHint, locale, 4)}</dd>
              </div>
            </>
          ) : null}
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
          <button type="button" className="cancel-wallet-btn" onClick={onClose}>
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
        onClose={reset}
      />
    </div>
  );
}
