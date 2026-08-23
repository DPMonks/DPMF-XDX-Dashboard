import { useCallback, useEffect, useState } from "react";
import { WalletContext } from "./walletContextInstance";
import { persistLiveWallet, readLiveWallet } from "../wallet/walletStorage";

export function WalletProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState(() => {
    const stored = readLiveWallet();
    if (typeof window !== "undefined") window.userAccount = stored;
    return stored;
  });

  useEffect(() => {
    if (walletAddress) persistLiveWallet(walletAddress);
    if (typeof window !== "undefined") {
      window.userAccount = walletAddress || readLiveWallet();
    }
  }, [walletAddress]);

  useEffect(() => {
    function hydrate() {
      const live = readLiveWallet();
      if (!live) return;
      setWalletAddress((current) => current || live);
    }
    const id = window.setTimeout(hydrate, 0);
    function onWake() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      window.setTimeout(hydrate, 0);
    }
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("pageshow", onWake);
    window.addEventListener("storage", onWake);
    return () => {
      clearTimeout(id);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("pageshow", onWake);
      window.removeEventListener("storage", onWake);
    };
  }, []);

  const connectWallet = useCallback((account) => {
    const next = persistLiveWallet(account);
    setWalletAddress(next);
  }, []);

  const disconnectWallet = useCallback(() => {
    persistLiveWallet(null);
    setWalletAddress(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{ walletAddress, connectWallet, disconnectWallet }}
    >
      {children}
    </WalletContext.Provider>
  );
}
