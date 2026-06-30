// src/components/ConnectWallet.jsx

import { useWallet } from "../context/WalletContext";

export default function ConnectWallet() {
  const { walletAddress, connectWallet, disconnectWallet } = useWallet();

  if (walletAddress) {
    return (
      <div className="wallet-connected">
        <span className="wallet-address">
          {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
        </span>
        <button className="disconnect-wallet-btn" onClick={disconnectWallet}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button className="connect-wallet-btn" onClick={connectWallet}>
      Connect Wallet
    </button>
  );
}
