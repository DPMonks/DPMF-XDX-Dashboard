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

      // Correct backend endpoint
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/xaman/create-payload`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        }
      );

      const data = await response.json();

      // Correct QR field
      if (!data.uuid || !data.refs?.qr_png) {
        console.error("Invalid payload:", data);
        setLoading(false);
        return;
      }

      // Store QR + UUID + WebSocket
      setQrData({
        qr: data.refs.qr_png,
        uuid: data.uuid,
        websocket: data.websocket
      });

      // WebSocket listener
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
};

export const useWallet = () => useContext(WalletContext);
