import { useEffect, useState } from "react";
import { WalletContext } from "./walletContextInstance";

const STORAGE_KEY = "dpmf-xdx-wallet";

export function WalletProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (walletAddress) {
        sessionStorage.setItem(STORAGE_KEY, walletAddress);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  }, [walletAddress]);

  const connectWallet = (account) => {
    setWalletAddress(account || null);
    window.userAccount = account || null;
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    window.userAccount = null;
  };

  return (
    <WalletContext.Provider
      value={{ walletAddress, connectWallet, disconnectWallet }}
    >
      {children}
    </WalletContext.Provider>
  );
}
