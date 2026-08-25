import { useEffect, useRef, useState } from "react";
import { pairParts } from "../utils/currency";
import { displayPoolSplit, formatPoolPct } from "../utils/poolSplit";
import { formatNumber, formatToken, formatUsd, formatUsdPrice, formatWhen, shortAddress } from "../utils/format";
import { formatAmmFee } from "../wallet/composeWallet";
import {
  ammPoolName,
  applyLivePoolReserves,
  compactPoolAmount,
  filterAmmPools,
  isLpPoolTrade,
  mergeAmmPoolLists,
  poolAssetTrustlineId,
  poolKey,
  poolQuoteTicker,
  poolSplitMeta,
  searchAmmAccount,
  searchPairHint,
  tradePoolHint,
} from "../ammPools";
import { discoverLiveAmmPool, getLiveLpReserves } from "../api/indexer";
import { xdxTrustSetTxjson } from "../constants/ledger";
import { useWallet } from "../context/useWallet";
import {
  QUOTE_ASSETS,
  isLpCurrency,
  lpTrustSetTxjson,
  notifyWalletRefresh,
  poolForQuote,
  quoteTrustSetTxjson,
  resolveQuote,
} from "../xaman/tradeTx";
import { useXamanPayload } from "../xaman/useXamanPayload";
import { liveWalletAddress } from "../wallet/walletStorage";
import { useI18n } from "../i18n/useI18n";
import Skeleton from "./Skeleton";
import WalletButton from "./WalletButton";
import WalletModal from "./WalletModal";

function SplitBar({ asset, quote, xdxPct, quotePct, lead, reserveXdx, reserveQuote, lpSupply, t }) {
  const split = displayPoolSplit(xdxPct, quotePct);
  const meta = poolSplitMeta({
    reserve_asset: reserveXdx,
    reserve_currency: reserveQuote,
    lp_supply: lpSupply,
  });
  const ready = split.measured;
  const xdxLead = lead === "xdx" || split.xdxPct >= split.quotePct;
  const xdxShare = Math.max(split.xdxPct, 0);
  const quoteShare = Math.max(split.quotePct, 0);
  const lpLine =
    meta.xdxPerLp != null && meta.quotePerLp != null && meta.lpSupply != null
      ? (t.poolLpLine || "1 LP · {xdx} {asset} + {quote} {quoteAsset} · {lp} LP")
          .replace("{xdx}", compactPoolAmount(meta.xdxPerLp))
          .replace("{asset}", asset)
          .replace("{quote}", compactPoolAmount(meta.quotePerLp))
          .replace("{quoteAsset}", quote)
          .replace("{lp}", compactPoolAmount(meta.lpSupply))
      : meta.lpSupply != null
        ? `LP ${compactPoolAmount(meta.lpSupply)}`
        : "";

  return (
    <div className={`pool-split ${ready ? (xdxLead ? "is-xdx-lead" : "is-quote-lead") : "is-pending"}`}>
      <div className="pool-split-labels">
        <span className={`pool-split-xdx ${xdxLead ? "is-lead" : ""}`}>
          <i className="pool-split-swatch is-xdx" aria-hidden="true" />
          <span className="pool-split-pct">{formatPoolPct(split.xdxPct)}%</span>
          <span className="pool-split-asset">{asset}</span>
          {meta.reserveXdx != null ? (
            <span className="pool-split-amt">{compactPoolAmount(meta.reserveXdx)}</span>
          ) : null}
        </span>
        <span className="pool-split-ratio">
          {meta.lpSupply != null
            ? `LP ${compactPoolAmount(meta.lpSupply)}`
            : `${formatPoolPct(split.xdxPct)} / ${formatPoolPct(split.quotePct)}`}
        </span>
        <span className={`pool-split-quote ${!xdxLead ? "is-lead" : ""}`}>
          {meta.reserveQuote != null ? (
            <span className="pool-split-amt">{compactPoolAmount(meta.reserveQuote)}</span>
          ) : null}
          <span className="pool-split-pct">{formatPoolPct(split.quotePct)}%</span>
          <span className="pool-split-asset">{quote}</span>
          <i className="pool-split-swatch is-quote" aria-hidden="true" />
        </span>
      </div>
      <div
        className={`pool-split-bar ${ready ? (xdxLead ? "is-xdx-lead" : "is-quote-lead") : "is-pending"}`}
        role="img"
        aria-label={`${formatPoolPct(split.xdxPct)} percent ${asset} ${compactPoolAmount(meta.reserveXdx)}, ${formatPoolPct(split.quotePct)} percent ${quote} ${compactPoolAmount(meta.reserveQuote)}, LP ${compactPoolAmount(meta.lpSupply)}`}
      >
        <span
          className="pool-split-bar-xdx"
          style={{ flexGrow: xdxShare, flexShrink: 0, flexBasis: 0 }}
        />
        <span
          className="pool-split-bar-quote"
          style={{ flexGrow: quoteShare, flexShrink: 0, flexBasis: 0 }}
        />
        <i className="pool-split-mid" style={{ left: `${xdxShare}%` }} aria-hidden="true" />
      </div>
      {lpLine ? <p className="pool-split-lp">{lpLine}</p> : null}
    </div>
  );
}

function poolQuote(pool) {
  const ticker = String(pool?.quote || "")
    .replace(/^XDX\//i, "")
    .toUpperCase() || poolAssetTrustlineId(pool);
  return resolveQuote(ticker === "XDX" ? "XRP" : ticker, {
    quote_issuer: pool.quote_issuer,
    quote_hex: pool.quote_hex,
  });
}

function assetTrustTxjson(pool, account) {
  if (poolAssetTrustlineId(pool) === "XDX") return xdxTrustSetTxjson(account);
  return quoteTrustSetTxjson(account, poolQuote(pool));
}

function lpTrustTxjson(pool, account) {
  const lpHex = pool?.lp_currency || pool?.lp_currency_hex;
  if (pool?.amm_account && isLpCurrency(lpHex)) {
    return lpTrustSetTxjson(account, { amm: pool.amm_account, lpCurrency: lpHex });
  }
  const quoteId = poolQuoteTicker(pool);
  const spec = poolForQuote(poolQuote(pool), [pool], pool);
  if (quoteId !== "XRP" && spec.pair === "XDX/XRP") return null;
  return lpTrustSetTxjson(account, spec);
}

export default function AmmCard({ pools, loading, error, onAddLiquidity, onRemoveLiquidity }) {
  const { t, locale } = useI18n();
  const { walletAddress, connectWallet } = useWallet();
  const { qr, mobileUrl, uuid, status, error: signError, start, reset } = useXamanPayload();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState([]);
  const [looking, setLooking] = useState(false);
  const [signKind, setSignKind] = useState("quote");
  const [signAsset, setSignAsset] = useState("XDX");
  const [lineError, setLineError] = useState("");
  const [liveByKey, setLiveByKey] = useState({});
  const lookupGen = useRef(0);
  const lookupTimer = useRef(0);
  const liveTimer = useRef(0);
  const catalog = mergeAmmPoolLists(pools, found);
  const filtered = filterAmmPools(catalog, query);
  const visible = filtered.map((row) => applyLivePoolReserves(row, liveByKey[poolKey(row)]));

  function pullLive(pool, extra = {}) {
    if (!pool) return;
    getLiveLpReserves({
      pair: pool.pool || pool.pool_name,
      quote: poolQuoteTicker(pool),
      issuer: pool.quote_issuer,
      hex: pool.quote_hex,
      ammAccount: pool.amm_account,
      fresh: extra.fresh,
    })
      .then((live) => {
        if (!live || live.empty || live.reserve_source === "empty") return;
        setLiveByKey((current) => ({ ...current, [poolKey(pool)]: live }));
      })
      .catch(() => {});
  }

  function refreshLive(targets, extra = {}) {
    const rows = (Array.isArray(targets) ? targets : []).filter(Boolean).slice(0, 8);
    window.clearTimeout(liveTimer.current);
    liveTimer.current = window.setTimeout(() => {
      rows.forEach((pool) => pullLive(pool, extra));
    }, extra.fresh ? 220 : 40);
  }
  const signing = status === "loading" || status === "waiting";
  const account = liveWalletAddress(walletAddress);

  function signTrustline(pool, kind) {
    const txjson = kind === "lp" ? lpTrustTxjson(pool, account) : assetTrustTxjson(pool, account);
    if (!txjson) {
      setLineError(kind === "lp" ? t.lpTrustlineError : t.trustlineError);
      return;
    }
    setLineError("");
    setSignKind(kind);
    setSignAsset(kind === "lp" ? "LP" : poolAssetTrustlineId(pool));
    start({
      body: { txjson },
      onSigned: (signedAccount) => {
        if (signedAccount) connectWallet(signedAccount);
        notifyWalletRefresh();
      },
      errorMessage: kind === "lp" ? t.lpTrustlineError : t.trustlineError,
    });
  }

  async function lookup(nextQuery) {
    const ammAccount = searchAmmAccount(nextQuery);
    const pair = searchPairHint(nextQuery);
    const quote = pair.split("/")[1] || "";
    if ((!pair && !ammAccount) || filterAmmPools(catalog, nextQuery).length) return;
    const known = QUOTE_ASSETS.find((row) => row.id === quote);
    const gen = (lookupGen.current += 1);
    setLooking(true);
    const hit = await discoverLiveAmmPool(pair, {
      quote,
      issuer: known?.issuer,
      hex: known?.hex,
      ammAccount,
    }).catch(() => null);
    if (gen !== lookupGen.current) return;
    setLooking(false);
    if (!hit) return;
    setFound((current) => mergeAmmPoolLists(current, [hit]));
  }

  function onSearch(value) {
    setQuery(value);
    window.clearTimeout(lookupTimer.current);
    if (!value.trim() || filterAmmPools(catalog, value).length) {
      lookupGen.current += 1;
      setLooking(false);
      return;
    }
    lookupTimer.current = window.setTimeout(() => lookup(value), 320);
  }

  useEffect(() => {
    function onTrade(event) {
      const detail = event?.detail || {};
      if (!isLpPoolTrade(detail)) return;
      const pair = tradePoolHint(detail);
      const rows = filterAmmPools(mergeAmmPoolLists(pools, found), query);
      const targets = pair ? rows.filter((row) => ammPoolName(row) === pair) : rows.slice(0, 6);
      refreshLive(targets.length ? targets : rows.slice(0, 6), { fresh: true });
    }
    window.addEventListener("dpmf-trade-executed", onTrade);
    return () => {
      window.removeEventListener("dpmf-trade-executed", onTrade);
      window.clearTimeout(liveTimer.current);
    };
  }, [found, pools, query]);

  if (loading && !pools.length && !found.length) {
    return (
      <div className="pool-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={260} />
        ))}
      </div>
    );
  }

  if (error && !pools.length && !found.length) {
    return <p className="error-message">{error}</p>;
  }

  return (
    <div className="amm-pools">
      <label className="amm-pools-search">
        <span className="sr-only">{t.searchPair || "Search XDX / asset"}</span>
        <input
          type="search"
          className="orderbook-search"
          value={query}
          placeholder={t.searchPair || "Search XDX / asset"}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>
      {looking ? <p className="amm-pools-looking">{t.lookingForPool || "Looking up that XDX pool on the ledger…"}</p> : null}
      {!catalog.length && !query.trim() ? (
        <p className="empty-message">{t.emptyPools}</p>
      ) : !visible.length ? (
        <p className="empty-message">{t.noMatchingPools || "No live XDX pools match that search."}</p>
      ) : (
        <div className="pool-grid">
          {visible.map((pool, index) => {
        const { asset, quote } = pairParts(pool.pool);
        const quoteName = pool.quote || quote;
        return (
          <article
            key={pool.amm_account || `${pool.pool}-${index}`}
            className={`pool-card ${
              pool.lead === "quote" ? "is-quote-lead" : pool.xdx_pct != null ? "is-xdx-lead" : ""
            }`}
          >
            <header className="pool-card-head">
              <span className="pair-badge">{pool.pool}</span>
              {pool.updated && (
                <span className="pool-updated">
                  {t.updated} {formatWhen(pool.updated, locale)}
                </span>
              )}
            </header>
            <SplitBar
              asset={asset}
              quote={quoteName}
              xdxPct={pool.xdx_pct}
              quotePct={pool.quote_pct}
              lead={pool.lead}
              reserveXdx={pool.reserve_asset ?? pool.reserve_xdx}
              reserveQuote={pool.reserve_currency}
              lpSupply={pool.lp_supply}
              t={t}
            />
            <dl className="pool-stats">
              {pool.amm_account ? (
                <div>
                  <dt>{t.ammAccount}</dt>
                  <dd title={pool.amm_account}>{shortAddress(pool.amm_account)}</dd>
                </div>
              ) : null}
              {pool.tvl != null ? (
                <div>
                  <dt>{t.tvl}</dt>
                  <dd>{formatUsd(pool.tvl, locale)}</dd>
                </div>
              ) : null}
              {pool.price != null ? (
                <div>
                  <dt>{t.price}</dt>
                  <dd>{formatUsdPrice(pool.price, locale)}</dd>
                </div>
              ) : null}
              <div>
                <dt>
                  {t.reserve} {asset}
                </dt>
                <dd>{formatToken(pool.reserve_asset, locale)}</dd>
              </div>
              {pool.reserve_currency != null ? (
                <div>
                  <dt>
                    {t.reserve} {quoteName}
                  </dt>
                  <dd>{formatToken(pool.reserve_currency, locale)}</dd>
                </div>
              ) : (
                <div>
                  <dt>{t.pair}</dt>
                  <dd>{quoteName}</dd>
                </div>
              )}
              {pool.lp_currency ? (
                <div>
                  <dt>{t.lp}</dt>
                  <dd title={pool.lp_currency}>{shortAddress(pool.lp_currency)}</dd>
                </div>
              ) : null}
              {pool.lp_supply != null ? (
                <div>
                  <dt>{t.lpSupply}</dt>
                  <dd>{formatToken(pool.lp_supply, locale)}</dd>
                </div>
              ) : null}
              <div>
                <dt>{t.fee}</dt>
                <dd>{formatAmmFee(pool.trading_fee, locale)}</dd>
              </div>
              {pool.apr != null ? (
                <div>
                  <dt>{t.apr}</dt>
                  <dd>{`${formatNumber(pool.apr, locale)}%`}</dd>
                </div>
              ) : null}
              {pool.volume24h != null ? (
                <div>
                  <dt>{t.volume24h}</dt>
                  <dd>{formatToken(pool.volume24h, locale)}</dd>
                </div>
              ) : null}
            </dl>
            <div className="pool-card-actions">
              {onAddLiquidity ? (
                <WalletButton
                  label={t.addLiquidity}
                  title={`${t.addLiquidity} ${pool.pool}`}
                  onClick={() => onAddLiquidity(pool)}
                />
              ) : null}
              {onRemoveLiquidity ? (
                <WalletButton
                  className="is-remove-lp"
                  label={t.removeLiquidity}
                  title={`${t.removeLiquidity} ${pool.pool}`}
                  onClick={() => onRemoveLiquidity(pool)}
                />
              ) : null}
              <WalletButton
                className="is-trustline"
                label={(t.quoteTrustline || "{asset} Trustline").replace("{asset}", poolAssetTrustlineId(pool))}
                title={(t.quoteTrustline || "{asset} Trustline").replace("{asset}", poolAssetTrustlineId(pool))}
                disabled={signing}
                onClick={() => signTrustline(pool, "quote")}
              />
              <WalletButton
                className="is-lp-trustline"
                label={t.lpTrustline}
                title={`${t.lpTrustline} ${pool.pool}`}
                disabled={signing}
                onClick={() => signTrustline(pool, "lp")}
              />
            </div>
          </article>
        );
          })}
        </div>
      )}
      {lineError || signError ? <p className="wallet-error">{lineError || signError}</p> : null}
      <WalletModal
        visible={signing}
        qrUrl={qr}
        mobileUrl={mobileUrl}
        uuid={uuid}
        status={status}
        preparingLabel={
          signKind === "lp"
            ? t.preparingLpTrustline
            : (t.preparingAssetTrustline || t.preparingTrustline || "Preparing {asset} trustline…").replace(
                "{asset}",
                signAsset
              )
        }
        scanLabel={
          signKind === "lp"
            ? t.scanLpTrustline
            : (t.scanAssetTrustline || t.scanTrustline || "Scan to add the {asset} trustline").replace(
                "{asset}",
                signAsset
              )
        }
        onClose={reset}
      />
    </div>
  );
}
