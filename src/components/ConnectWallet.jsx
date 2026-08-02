import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { createPayload } from "../xaman/xamanClient";
import WalletButton from "./WalletButton";

export default function ConnectWallet() {
  const { walletAddress, connectWallet, disconnectWallet } = useWallet();

  const [qr, setQr] = useState(null);
  const [mobileLink, setMobileLink] = useState(null);
  const [status, setStatus] = useState("idle");
  const [ws, setWs] = useState(null);

  async function startConnection() {
    try {
      setStatus("loading");

      const payload = await createPayload();

      if (!payload?.refs) {
        console.error("Invalid payload:", payload);
        setStatus("idle");
        return;
      }

      setQr(payload.refs.qr_png);
      setMobileLink(payload.next?.always || payload.refs.deeplink_web);
      setStatus("waiting");

      const socket = new WebSocket(payload.refs.websocket_status);
      setWs(socket);

      socket.onmessage = (msg) => {
        const data = JSON.parse(msg.data);

        if (data.signed && data.account) {
          // Update wallet context
          connectWallet(data.account);

          // Close modal immediately
          setQr(null);
          setMobileLink(null);
          setStatus("idle");

          socket.close();
        }
      };

      socket.onerror = (err) => console.error("WS ERROR:", err);
    } catch (err) {
      console.error("Wallet connect error:", err);
      setStatus("idle");
    }
  }

  function closeModal() {
    setQr(null);
    setMobileLink(null);
    setStatus("idle");
    if (ws) ws.close();
  }

  return (
    <>
      {!walletAddress ? (
        <WalletButton
          onClick={startConnection}
          disabled={status === "loading" || status === "waiting"}
        />
      ) : (
        <div className="wallet-connected">
          <span>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
          <button onClick={disconnectWallet}>Disconnect</button>
        </div>
      )}

      {qr && (
        <div className="wallet-modal-overlay">
          <div className="wallet-modal">
            <h2 className="modal-title">
              {status === "loading" && "Preparing…"}
              {status === "waiting" && "Scan with Xaman"}
            </h2>

            {status !== "loading" && (
              <img src={qr} alt="QR" className="qr-image" />
            )}

            {mobileLink && (
              <a href={mobileLink} className="mobile-link-btn">
                Open in Xaman App
              </a>
            )}

            <button onClick={closeModal} className="cancel-wallet-btn">
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
