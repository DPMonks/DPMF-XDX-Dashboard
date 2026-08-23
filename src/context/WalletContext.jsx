import { useCallback, useEffect, useState } from "react";
import { WalletContext } from "./walletContextInstance";

const STORAGE_KEY = "dpmf-xdx-wallet";

function readStoredWallet() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function persistWallet(account) {
  try {
    if (account) sessionStorage.setItem(STORAGE_KEY, account);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}

export function WalletProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState(() => {
    const stored = readStoredWallet();
    if (typeof window !== "undefined") window.userAccount = stored;
    return stored;
  });

  useEffect(() => {
    persistWallet(walletAddress);
    window.userAccount = walletAddress || null;
  }, [walletAddress]);

  const connectWallet = useCallback((account) => {
    const next = account || null;
    persistWallet(next);
    setWalletAddress(next);
    window.userAccount = next;
  }, []);

  const disconnectWallet = useCallback(() => {
    persistWallet(null);
    setWalletAddress(null);
    window.userAccount = null;
  }, []);

  return (
    <WalletContext.Provider
      value={{ walletAddress, connectWallet, disconnectWallet }}
    >
      {children}
    </WalletContext.Provider>
  );
}
