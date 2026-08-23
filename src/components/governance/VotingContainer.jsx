import { useEffect, useMemo, useState } from "react";
import { getAmm, getPoolGovernance, getWalletLp, getWalletVotes } from "../../api/indexer";
import { useWallet } from "../../context/useWallet";
import { useI18n } from "../../i18n/useI18n";
import { shortAddress } from "../../utils/format";
import { lpHeldForPair, resolveQuote, WALLET_EVENTS } from "../../xaman/tradeTx";
import { useXamanPayload } from "../../xaman/useXamanPayload";
import {
  ammVoteTxjson,
  feePercentFromUnits,
  knownGovernancePairs,
  voteHistoryFromActivity,
} from "../../wallet/ammVote";
import WalletModal from "../WalletModal";
import GovernanceDataPanel from "./GovernanceDataPanel";
import PoolSelector from "./PoolSelector";
import VoteHistory from "./VoteHistory";
import VotePanel from "./VotePanel";

export default function VotingContainer() {
  const { t, locale } = useI18n();
  const { walletAddress } = useWallet();
  const { qr, mobileUrl, uuid, status, error, start, reset } = useXamanPayload();
  const [pools, setPools] = useState([]);
  const [lpRows, setLpRows] = useState([]);
  const [pair, setPair] = useState("XDX/XRP");
  const [gov, setGov] = useState(null);
  const [history, setHistory] = useState([]);
  const [fee, setFee] = useState(0.25);
  const [confirming, setConfirming] = useState(false);

  const heldPairs = useMemo(
    () =>
      knownGovernancePairs(pools).filter((name) => lpHeldForPair(lpRows, name, name.split("/")[1]) > 0),
    [pools, lpRows]
  );
  const options = useMemo(() => {
    const names = heldPairs.length ? heldPairs : knownGovernancePairs(pools);
    return names.map((name) => ({ id: name, label: name }));
  }, [heldPairs, pools]);
  const eligible = lpHeldForPair(lpRows, pair, pair.split("/")[1]) > 0;

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      const [nextPools, nextLp] = await Promise.all([
        getAmm().catch(() => []),
        walletAddress ? getWalletLp(walletAddress).catch(() => []) : [],
      ]);
      if (cancelled) return;
      setPools(Array.isArray(nextPools) ? nextPools : []);
      setLpRows(Array.isArray(nextLp) ? nextLp : []);
    }
    const startLoad = setTimeout(loadCatalog, 0);
    window.addEventListener("dpmf-wallet-refresh", loadCatalog);
    return () => {
      cancelled = true;
      clearTimeout(startLoad);
      window.removeEventListener("dpmf-wallet-refresh", loadCatalog);
    };
  }, [walletAddress]);

  useEffect(() => {
    if (heldPairs.length && !heldPairs.includes(pair)) {
      const id = setTimeout(() => setPair(heldPairs[0]), 0);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [heldPairs, pair]);

  useEffect(() => {
    let cancelled = false;
    async function loadGov() {
      const [nextGov, votes] = await Promise.all([
        getPoolGovernance(pair, walletAddress).catch(() => null),
        walletAddress ? getWalletVotes(walletAddress).catch(() => []) : [],
      ]);
      if (cancelled) return;
      setGov(nextGov);
      setHistory(voteHistoryFromActivity(votes, nextGov?.voteSlots || []));
      const current = nextGov?.yourVote?.tradingFee ?? nextGov?.tradingFee;
      if (Number.isFinite(Number(current))) {
        setFee(feePercentFromUnits(current));
      }
    }
    const startLoad = setTimeout(loadGov, 0);
    function onRefresh() {
      loadGov();
    }
    window.addEventListener("dpmf-wallet-refresh", onRefresh);
    window.addEventListener("dpmf-trade-executed", onRefresh);
    return () => {
      cancelled = true;
      clearTimeout(startLoad);
      window.removeEventListener("dpmf-wallet-refresh", onRefresh);
      window.removeEventListener("dpmf-trade-executed", onRefresh);
    };
  }, [pair, walletAddress]);

  function askConfirm() {
    if (!walletAddress) {
      window.dispatchEvent(new Event(WALLET_EVENTS.needSignIn));
      return;
    }
    if (!eligible) return;
    setConfirming(true);
  }

  function signVote() {
    const quote = resolveQuote(pair.split("/")[1], {
      quote_issuer: pools.find((row) => String(row.pool || row.pool_name).toUpperCase() === pair)?.quote_issuer,
      quote_hex: pools.find((row) => String(row.pool || row.pool_name).toUpperCase() === pair)?.quote_hex,
    });
    start({
      body: {
        txjson: ammVoteTxjson({
          account: walletAddress,
          quote,
          tradingFee: fee,
        }),
      },
      errorMessage: t.voteSignError,
      onExecuted: () => {
        setConfirming(false);
        reset();
      },
    });
  }

  return (
    <div className="governance-box">
      <header className="governance-head">
        <div>
          <p className="governance-wallet">
            {walletAddress ? shortAddress(walletAddress) : t.connectWalletHint}
          </p>
        </div>
        <p className={`governance-elig${eligible ? " is-yes" : " is-no"}`}>
          {eligible ? t.eligibleVoter : t.notEligibleVoter}
        </p>
      </header>

      <PoolSelector
        value={pair}
        options={options}
        onChange={setPair}
        ariaLabel={t.votePool}
      />
      <GovernanceDataPanel data={gov} locale={locale} t={t} />
      <VotePanel
        fee={fee}
        onFee={setFee}
        eligible={eligible}
        signedIn={Boolean(walletAddress)}
        confirming={confirming}
        onAskConfirm={askConfirm}
        onCancelConfirm={() => setConfirming(false)}
        onSign={signVote}
        pair={pair}
        locale={locale}
        t={t}
      />
      <VoteHistory rows={history} locale={locale} t={t} />
      {error ? <p className="wallet-error">{error}</p> : null}
      <WalletModal
        visible={status === "loading" || status === "waiting"}
        qrUrl={qr}
        mobileUrl={mobileUrl}
        uuid={uuid}
        status={status}
        preparingLabel={t.preparingVote}
        scanLabel={t.scanVote}
        onClose={reset}
      />
    </div>
  );
}
