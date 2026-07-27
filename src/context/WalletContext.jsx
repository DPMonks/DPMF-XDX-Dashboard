import { createContext, useContext, useState } from "react";
import { createPayload } from "../xaman/xamanClient";

const WalletContext = createContext();

export function WalletProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [mobileUrl, setMobileUrl] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [wsConnection, setWsConnection] = useState(null);
  const [toast, setToast] = useState(null);

  const connectWallet = async () => {
    try {
      const payload = await createPayload();

      setQrUrl(payload.refs.qr_png);
      setMobileUrl(payload.refs.deeplink_web);
      setModalOpen(true);

      const ws = new WebSocket(payload.websocket);
      setWsConnection(ws);

      ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);

        if (data.signed === true && data.account) {
          setWalletAddress(data.account);

          // Toast
          setToast("Wallet Connected");
          setTimeout(() => setToast(null), 3000);

          setModalOpen(false);
          setQrUrl(null);
          ws.close();
        }
      };
    } catch (err) {
      console.error("Wallet connect error:", err);
    }
  };

  const cancelConnect = () => {
    setModalOpen(false);
    setQrUrl(null);
    setMobileUrl(null);

    if (wsConnection) {
      wsConnection.close();
      setWsConnection(null);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setToast("Wallet Disconnected");
    setTimeout(() => setToast(null), 3000);

    if (wsConnection) {
      wsConnection.close();
      setWsConnection(null);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        connectWallet,
        disconnectWallet,
        cancelConnect,
        modalOpen,
        qrUrl,
        mobileUrl,
        toast
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
