import { useEffect, useRef, useState } from "react";
import { useWallet } from "../context/useWallet";
import {
  createPayload,
  extractSignedAccount,
  getPayloadResult,
} from "../xaman/xamanClient";
import { shortAddress } from "../utils/format";
import { useI18n } from "../i18n/useI18n";
import WalletButton from "./WalletButton";
import WalletModal from "./WalletModal";

export default function ConnectWallet() {
  const { t } = useI18n();
  const { walletAddress, connectWallet, disconnectWallet } = useWallet();
  const [qr, setQr] = useState(null);
  const [mobileUrl, setMobileUrl] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const timeoutRef = useRef(null);
  const pollRef = useRef(null);

  const resetModal = () => {
    setQr(null);
    setMobileUrl(null);
    setStatus("idle");
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const finishSignIn = (account) => {
    if (!account) return;
    connectWallet(account);
    resetModal();
    setStatus("signed");
  };

  async function startConnection() {
    if (walletAddress) {
      disconnectWallet();
      return;
    }

    if (status === "loading" || status === "waiting") return;

    try {
      setError(null);
      setStatus("loading");

      const payload = await createPayload();
      setQr(payload.qr);
      setMobileUrl(payload.mobileUrl);
      setStatus("waiting");

      timeoutRef.current = setTimeout(() => {
        resetModal();
      }, 120000);

      const settle = async () => {
        const result = await getPayloadResult(payload.uuid);
        const account = extractSignedAccount(result);
        if (account) finishSignIn(account);
      };

      pollRef.current = setInterval(() => {
        settle().catch(() => {});
      }, 2500);

      if (payload.websocket) {
        const socket = new WebSocket(payload.websocket);
        socketRef.current = socket;

        socket.onmessage = async (event) => {
          const data = JSON.parse(event.data);
          if (!data.signed) return;
          const result = await getPayloadResult(payload.uuid);
          finishSignIn(extractSignedAccount(result) || data.account);
        };

        socket.onerror = () => {
          setError(t.walletError);
        };
      }
    } catch (err) {
      console.error("Wallet connect error:", err);
      setError(err.message || t.walletError);
      resetModal();
    }
  }

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
        status={status}
        onClose={resetModal}
      />
    </div>
  );
}
