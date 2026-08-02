import { createContext, useContext, useState } from "react";

const WalletContext = createContext();

export function WalletProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState(null);
  const [toast, setToast] = useState(null);

  const connectWallet = (account) => {
    setWalletAddress(account);
    setToast("Wallet Connected");
    setTimeout(() => setToast(null), 3000);
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setToast("Wallet Disconnected");
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        connectWallet,
        disconnectWallet,
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
