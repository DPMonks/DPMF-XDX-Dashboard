// src/XamanApp.jsx

import { useWallet } from "./context/WalletContext";
import { useState, useEffect } from "react";

import Dashboard from "./components/Dashboard";
import Header from "./components/Header";

export default function XamanApp() {
  const { walletAddress, connectWallet, disconnectWallet, qrData, loading } =
    useWallet();

  const [showModal, setShowModal] = useState(false);
  const [countdown, setCountdown] = useState(30);

  // Countdown timer logic
  useEffect(() => {
    if (!showModal) return;

    setCountdown(30);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setShowModal(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showModal]);

  const handleConnect = async () => {
    await connectWallet();
    setShowModal(true);
  };

  const handleCancel = () => {
    setShowModal(false);
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setShowModal(false);
  };

  return (
    <>
      <Header
        walletAddress={walletAddress}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      {/* Futuristic QR Modal */}
      {showModal && qrData && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
          }}
        >
          <div
            style={{
              background: "rgba(10,10,10,0.9)",
              padding: "32px",
              borderRadius: "18px",
              width: "400px",
              textAlign: "center",
              boxShadow: "0 0 50px rgba(0,255,180,0.25)",
              border: "1px solid rgba(0,255,180,0.35)",
              animation: "fadeIn 0.3s ease-out"
            }}
          >
            <h2
              style={{
                color: "#00ffcc",
                marginBottom: "20px",
                fontWeight: "600",
                letterSpacing: "1px"
              }}
            >
              Xaman Wallet Sign‑In
            </h2>

            {/* QR Code */}
            <img
              src={qrData.qr}
              alt="Xaman QR"
              style={{
                width: "260px",
                height: "260px",
                margin: "0 auto",
                borderRadius: "12px",
                boxShadow: "0 0 25px rgba(0,255,180,0.35)",
                animation: "pulseGlow 2s infinite ease-in-out"
              }}
            />

            {/* Countdown */}
            <p
              style={{
                color: "#fff",
                marginTop: "16px",
                fontSize: "14px",
                opacity: 0.8
              }}
            >
              QR expires in <strong>{countdown}</strong> seconds
            </p>

            {/* Cancel Button */}
            <button
              onClick={handleCancel}
              style={{
                marginTop: "20px",
                padding: "12px 20px",
                width: "100%",
                background: "#222",
                color: "#fff",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                fontSize: "16px",
                transition: "0.2s"
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Dashboard */}
      <Dashboard walletAddress={walletAddress} />
    </>
  );
}
