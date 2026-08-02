import { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
import { createPayload } from "../xaman/xamanClient";
import xamanLogo from "../assets/Xaman.jpg";

export default function ConnectWallet() {
  const { walletAddress, connectWallet, disconnectWallet } = useWallet();

  const [qr, setQr] = useState(null);
  const [wsUrl, setWsUrl] = useState(null);
  const [mobileLink, setMobileLink] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | waiting | signed
  const [ws, setWs] = useState(null);

  async function handleConnect() {
    try {
      setStatus("loading");

      const payload = await createPayload();

      // Show QR modal
      setQr(payload.refs.qr_png);

      // Websocket URL
      setWsUrl(payload.refs.websocket_status);

      // Mobile deep link
      setMobileLink(payload.next?.always);

      // Switch to waiting state
      setStatus("waiting");

      // Open websocket listener
      const socket = new WebSocket(payload.refs.websocket_status);

      socket.onopen = () => {
        console.log("WebSocket connected");
      };

      socket.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        console.log("WS EVENT:", data);

        if (data.signed) {
          setStatus("signed");

          // Close modal
          setQr(null);

          // Save wallet address
          connectWallet(data.account);

          // Close websocket
          socket.close();
        }
      };

      socket.onerror = (err) => {
        console.error("WS ERROR:", err);
      };

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
    <div className="wallet-box">
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

      {/* MODAL */}
      {qr && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            animation: "fadeIn 0.3s ease"
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "25px",
              borderRadius: "14px",
              textAlign: "center",
              width: "340px",
              boxShadow: "0 0 30px rgba(0,0,0,0.4)",
              animation: "scaleIn 0.25s ease"
            }}
          >
            <h2 style={{ marginBottom: "15px" }}>
              {status === "loading" && "Preparing…"}
              {status === "waiting" && "Scan with Xaman"}
              {status === "signed" && "Signed!"}
            </h2>

            {/* LOADING SPINNER */}
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

            {/* QR CODE */}
            {status !== "loading" && (
              <img
                src={qr}
                alt="Xaman QR Code"
                style={{
                  width: "260px",
                  height: "260px",
                  borderRadius: "8px",
                  marginBottom: "15px"
                }}
              />
            )}

            {/* MOBILE BUTTON */}
            {mobileLink && (
              <a
                href={mobileLink}
                style={{
                  display: "block",
                  marginTop: "10px",
                  padding: "12px",
                  background: "#00c853",
                  color: "#000",
                  borderRadius: "10px",
                  textDecoration: "none",
                  fontWeight: "bold"
                }}
              >
                Open in Xaman App
              </a>
            )}

            {/* CLOSE BUTTON */}
            <button
              onClick={closeModal}
              style={{
                marginTop: "16px",
                padding: "10px 20px",
                width: "100%",
                background: "#222",
                color: "#fff",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                fontSize: "16px"
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ANIMATIONS */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes scaleIn {
            from { transform: scale(0.8); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}
