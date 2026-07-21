// src/WalletContext.jsx

import { createContext, useContext, useState } from "react";

const WalletContext = createContext();

export function WalletProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);

  const connectWallet = async () => {
    try {
      setLoading(true);

      // Request XUMM SignIn payload from Railway backend
      const response = await fetch(
        "https://dpmf-xdx-indexer-production.up.railway.app/api/create-xumm-payload",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        }
      );

      const data = await response.json();

      if (!data.uuid || !data.qr) {
        console.error("Invalid payload:", data);
        setLoading(false);
        return;
      }

      // Store QR + UUID for modal
      setQrData({
        qr: data.qr,
        uuid: data.uuid,
        websocket: data.websocket
      });

      // Subscribe to XUMM WebSocket
      const ws = new WebSocket(data.websocket);

      ws.onmessage = (msg) => {
        const event = JSON.parse(msg.data);

        if (event.signed) {
          const account = event.account;
          setWalletAddress(account);
          ws.close();
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
      };

    } catch (err) {
      console.error("Wallet connect error:", err);
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setQrData(null);
  };

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        connectWallet,
        disconnectWallet,
        qrData,
        loading
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
