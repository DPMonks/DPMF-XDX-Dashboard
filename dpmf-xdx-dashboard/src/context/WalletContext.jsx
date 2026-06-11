import { createContext, useContext, useState } from "react";
import { Xumm } from "xumm";

const WalletContext = createContext();

// Initialise Xaman SDK
const xumm = new Xumm("YOUR_XUMM_API_KEY");

export const WalletProvider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState(null);

  const connectWallet = async () => {
    try {
      // 1. Create SignIn payload
      const payload = await xumm.payload.create({
        TransactionType: "SignIn"
      });

      // 2. Subscribe for QR scan + sign
      const subscription = await xumm.payload.subscribe(payload.uuid);

      // 3. Wait for user to sign
      const resolved = await subscription.resolved;

      if (resolved?.signed) {
        const userAccount = resolved.response.account;

        // Store in React context
        setWalletAddress(userAccount);

        // Store globally for future functions
        window.userAccount = userAccount;
      } else {
        console.warn("User cancelled sign-in");
      }
    } catch (err) {
      console.error("Xaman sign-in error:", err);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    window.userAccount = null;
  };

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        connectWallet,
        disconnectWallet,
        setWalletAddress
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);
