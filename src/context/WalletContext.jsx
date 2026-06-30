// src/context/WalletContext.jsx

import { createContext, useContext, useState, useEffect } from "react";
import { generateQrPayload } from "../utils/Xaman";

const WalletContext = createContext();

export function WalletProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState(null);
  const [payloadUuid, setPayloadUuid] = useState(null);

  // Restore wallet on refresh
  useEffect(() => {
    const saved = localStorage.getItem("walletAddress");
    if (saved) {
      setWalletAddress(saved);
      window.userAccount = saved;
    }
  }, []);

  // Connect wallet via Xaman QR
  const connectWallet = async () => {
    setLoading(true);
    setModalOpen(true);

    try {
      const { qr, uuid, websocket } = await generateQrPayload();

      // Show QR immediately
      setQrUrl(qr);
      setPayloadUuid(uuid);

      // Force eager load (fixes Vercel lazy-loading)
      const qrImg = document.getElementById("orderQrImg");
      if (qrImg) {
        qrImg.loading = "eager";
        qrImg.decoding = "sync";
        qrImg.fetchPriority = "high";
        qrImg.src = qr;
        qrImg.style.display = "block";
      }

      // WebSocket listener for signed payload
      const ws = new WebSocket(websocket);

      ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);

        if (data.signed === true) {
          const account = data.response.account;

          setWalletAddress(account);
          localStorage.setItem("walletAddress", account);
          window.userAccount = account;

          setModalOpen(false);
          setQrUrl(null);

          ws.close();
        }
      };
    } catch (err) {
      console.error("QR sign‑in failed:", err);
      alert("Wallet error — check console for details.");
      setModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setWalletAddress(null);
    localStorage.removeItem("walletAddress");
    window.userAccount = null;
  };

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        loading,
        modalOpen,
        qrUrl,
        payloadUuid,
        connectWallet,
        disconnectWallet,
        setModalOpen
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}

