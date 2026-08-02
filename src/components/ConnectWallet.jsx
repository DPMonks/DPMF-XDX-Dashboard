import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { createPayload } from "../xaman/xamanClient";
import xamanLogo from "../assets/Xaman.jpg";

export default function ConnectWallet() {
  const { walletAddress, connectWallet, disconnectWallet } = useWallet();

  const [qr, setQr] = useState(null);
  const [wsUrl, setWsUrl] = useState(null);
  const [mobileLink, setMobileLink] = useState(null);
  const [status, setStatus] = useState("idle");
  const [ws, setWs] = useState(null);

  async function handleConnect() {
    try {
      setStatus("loading");

      const payload = await createPayload();

      setQr(payload.refs.qr_png);
      setWsUrl(payload.refs.websocket_status);
      setMobileLink(payload.refs.deeplink_web);
      setStatus("waiting");

      const socket = new WebSocket(payload.refs.websocket_status);

      socket.onopen = () => console.log("WebSocket connected");

      socket.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        console.log("WS EVENT:", data);

        if (data.signed && data.account) {
          setStatus("signed");
          setQr(null);

          // FIXED: call connectWallet WITHOUT arguments
          connectWallet();

          socket.close();
        }
      };

      socket.onerror = (err) => console.error("WS ERROR:", err);

      setWs(socket);
    } catch (err) {
      console.error("Wallet connect error:", err);
      setStatus("idle");
    }
  }

  function closeModal() {
    setQr(null);
    setStatus("idle");
    if (ws) ws.close();
  }

  return (
    <>
      {!walletAddress ? (
        <button className="connect-wallet-btn" onClick={handleConnect}>
          <img src={xamanLogo} alt="Xaman" className="wallet-logo" />
          Connect Wallet
        </button>
      ) : (
        <div className="wallet-connected">
          <img src={xamanLogo} alt="Xaman" className="wallet-logo" />
          <span className="wallet-address">
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </span>
          <button className="disconnect-wallet-btn" onClick={disconnectWallet}>
            Disconnect
          </button>
        </div>
      )}

      {qr && (
        <div className="wallet-modal-overlay">
          <div className="wallet-modal">
            <h2 className="modal-title">
              {status === "loading" && "Preparing…"}
              {status === "waiting" && "Scan with Xaman"}
              {status === "signed" && "Signed!"}
            </h2>

            {status === "loading" && (
              <div
                style={{
                  width: "50px",
                  height: "50px",
                  border: "6px solid #ccc",
                  borderTopColor: "#000",
                  borderRadius: "50%",
                  margin: "20px auto",
                  animation: "spin 1s linear infinite"
                }}
              />
            )}

            {status !== "loading" && (
              <img src={qr} alt="Xaman QR Code" className="qr-image" />
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
