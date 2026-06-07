import { createContext, useContext, useState } from "react";

const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState(null);

  const connectWallet = async () => {
    try {
      if (!window.xrpl) {
        alert("Xaman / XRPL Wallet not detected");
        return;
      }

      const result = await window.xrpl.request({
        command: "account_info",
      });

      if (result?.account) {
        setWalletAddress(result.account);
      }
    } catch (err) {
      console.error("Wallet connect error:", err);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
  };

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        connectWallet,
        disconnectWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);
