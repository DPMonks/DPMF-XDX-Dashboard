import { createContext, useContext, useState } from "react";

const WalletContext = createContext();

export function WalletProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState(null);

  const connectWallet = (account) => {
    setWalletAddress(account);
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
  };

  return (
    <WalletContext.Provider value={{ walletAddress, connectWallet, disconnectWallet }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
