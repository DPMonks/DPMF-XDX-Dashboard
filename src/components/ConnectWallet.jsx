import { useEffect, useRef, useState } from "react";
import { useWallet } from "../context/useWallet";
import {
  createPayload,
  extractSignedAccount,
  getPayloadResult,
} from "../xaman/xamanClient";
import { shortAddress } from "../utils/format";
import WalletButton from "./WalletButton";
import WalletModal from "./WalletModal";

export default function ConnectWallet() {
  const { walletAddress, connectWallet, disconnectWallet } = useWallet();
  const [qr, setQr] = useState(null);
  const [mobileUrl, setMobileUrl] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const timeoutRef = useRef(null);

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
  };

  useEffect(() => () => resetModal(), []);

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
      }, 30000);

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
          setError("Wallet sign-in connection failed");
        };
      }
    } catch (err) {
      console.error("Wallet connect error:", err);
      setError(err.message || "Failed to start Xaman sign-in");
      resetModal();
    }
  }

  return (
    <>
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
    </>
  );
}
