import { useContext } from "react";
import { WalletContext } from "./walletContextInstance";

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
}
