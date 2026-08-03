import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { createPayload, getPayloadResult } from "../xaman/xamanClient";
import WalletButton from "./WalletButton";

export default function ConnectWallet() {
  const { connectWallet } = useWallet();

  const [qr, setQr] = useState(null);
  const [mobileLink, setMobileLink] = useState(null);
  const [status, setStatus] = useState("idle");
  const [ws, setWs] = useState(null);

  async function startConnection() {
    try {
      if (status === "loading" || status === "waiting") return;

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

      socket.onmessage = async (msg) => {
        const data = JSON.parse(msg.data);

        if (data.signed) {
          setQr(null);
          setMobileLink(null);
          setStatus("signed");

          const result = await getPayloadResult(payload.uuid);
          if (result?.response?.account) {
            connectWallet(result.response.account);
          }

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
      {/* BUTTON ONLY */}
      <WalletButton
        onClick={startConnection}
        disabled={status === "loading" || status === "waiting"}
      />

      {/* MODAL RENDERED OUTSIDE HEADER */}
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
