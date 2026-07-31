import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { createPayload } from "../xaman/xamanClient";
import xamanLogo from "../assets/Xaman.jpg";

function QrModal({ qr, onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "12px",
          textAlign: "center",
          maxWidth: "90%",
          boxShadow: "0 0 20px rgba(0,0,0,0.4)"
        }}
      >
        <h2 style={{ marginBottom: "15px" }}>Scan with Xaman</h2>

        <img
          src={qr}
          alt="Xaman QR Code"
          style={{
            width: "260px",
            height: "260px",
            borderRadius: "8px"
          }}
        />

        <button
          onClick={onClose}
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            background: "#333",
            color: "#fff",
            cursor: "pointer",
            fontSize: "16px"
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function ConnectWallet() {
  const { walletAddress, connectWallet, disconnectWallet } = useWallet();
  const [qr, setQr] = useState(null);

  async function handleConnect() {
    try {
      // Step 1: Create payload from backend
      const payload = await createPayload();

      // Step 2: Show QR modal
      setQr(payload.refs.qr_png);

      // Step 3: Trigger wallet context connection (optional)
      connectWallet();
    } catch (err) {
      console.error("Wallet connect error:", err);
    }
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

      {qr && <QrModal qr={qr} onClose={() => setQr(null)} />}
    </div>
  );
}
