// src/context/WalletContext.jsx

import { createContext, useContext, useState } from "react";

const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);

  const connectWallet = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/xaman/create-payload`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        }
      );

      const data = await response.json();

      if (!data.uuid || !data.refs?.qr_png || !data.websocket) {
        console.error("Invalid payload:", data);
        setLoading(false);
        return;
      }

      // Store QR + UUID + WebSocket URL
      setQrData({
        qr: data.refs.qr_png,
        uuid: data.uuid,
        websocket: data.websocket
      });

      // Open WebSocket listener
      const ws = new WebSocket(data.websocket);

      ws.onmessage = (msg) => {
        const event = JSON.parse(msg.data);

        if (event.signed) {
          setWalletAddress(event.account);
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
};

export const useWallet = () => useContext(WalletContext);
