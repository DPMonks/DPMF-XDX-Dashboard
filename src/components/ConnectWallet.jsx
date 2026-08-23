import { useCallback, useEffect, useRef } from "react";
import { useWallet } from "../context/useWallet";
import { shortAddress } from "../utils/format";
import { takeXamanReturnUuid } from "../xaman/payloadResume";
import { liveWalletAddress, resolveNeedSignIn } from "../wallet/walletStorage";
import { WALLET_EVENTS } from "../xaman/tradeTx";
import { useXamanPayload } from "../xaman/useXamanPayload";
import { useI18n } from "../i18n/useI18n";
import WalletButton from "./WalletButton";
import WalletModal from "./WalletModal";

export default function ConnectWallet() {
  const { t } = useI18n();
  const { walletAddress, connectWallet, disconnectWallet } = useWallet();
  const { qr, mobileUrl, uuid, status, error, start, reset } = useXamanPayload();
  const startRef = useRef(start);

  useEffect(() => {
    startRef.current = start;
  }, [start]);

  const finishSignIn = useCallback((account) => {
    if (!account) return;
    connectWallet(account);
    window.dispatchEvent(new CustomEvent(WALLET_EVENTS.signedIn, { detail: { account } }));
  }, [connectWallet]);

  const resumeSignIn = useCallback(() => {
    if (liveWalletAddress(walletAddress)) return;
    const pending = takeXamanReturnUuid();
    if (!pending) return;
    startRef.current({
      resumeUuid: pending,
      onSigned: finishSignIn,
      errorMessage: t.walletError,
    });
  }, [walletAddress, finishSignIn, t.walletError]);

  function startConnection() {
    if (liveWalletAddress(walletAddress)) {
      reset();
      disconnectWallet();
      return;
    }

    start({
      onSigned: finishSignIn,
      errorMessage: t.walletError,
    });
  }

  function cancelSignIn() {
    reset();
    window.dispatchEvent(new Event(WALLET_EVENTS.signInCancelled));
  }

  useEffect(() => {
    function onNeedSignIn() {
      const next = resolveNeedSignIn(walletAddress);
      if (next.action === "already-signed-in") {
        if (!walletAddress) connectWallet(next.account);
        window.dispatchEvent(
          new CustomEvent(WALLET_EVENTS.signedIn, { detail: { account: next.account } })
        );
        return;
      }
      startRef.current({
        onSigned: finishSignIn,
        errorMessage: t.walletError,
      });
    }
    window.addEventListener(WALLET_EVENTS.needSignIn, onNeedSignIn);
    return () => window.removeEventListener(WALLET_EVENTS.needSignIn, onNeedSignIn);
  }, [walletAddress, connectWallet, finishSignIn, t.walletError]);

  useEffect(() => {
    const boot = window.setTimeout(() => resumeSignIn(), 0);
    function wake() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      window.setTimeout(() => resumeSignIn(), 0);
    }
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("pageshow", wake);
    window.addEventListener("focus", wake);
    return () => {
      clearTimeout(boot);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("focus", wake);
    };
  }, [resumeSignIn]);

  return (
    <div className="wallet-control">
      <WalletButton
        onClick={startConnection}
        disabled={status === "loading" || status === "waiting"}
        connected={Boolean(walletAddress)}
        address={shortAddress(walletAddress)}
      />
      {error && <p className="wallet-error">{error}</p>}
      <WalletModal
        visible={status === "loading" || status === "waiting"}
        qrUrl={qr}
        mobileUrl={mobileUrl}
        uuid={uuid}
        status={status}
        onClose={cancelSignIn}
      />
    </div>
  );
}
