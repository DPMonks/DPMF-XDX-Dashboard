import { createContext, useContext, useState } from "react";

const WalletContext = createContext();

export function WalletProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState(null);

  const disconnectWallet = () => {
    setWalletAddress(null);
    window.userAccount = null;
  };

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        setWalletAddress,
        disconnectWallet
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
