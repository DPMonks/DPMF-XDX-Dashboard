// src/components/WalletStatusBar.jsx
import { useWallet } from "../context/WalletContext";

export default function WalletStatusBar() {
  const { walletAddress, truncatedAddress, connectWallet, disconnectWallet, loading } =
    useWallet();

  return (
    <div className="wallet-status-bar">
      {walletAddress ? (
        <>
          <span className="wallet-status-text">
            Connected as: <strong>{truncatedAddress}</strong>
          </span>
          <button className="wallet-status-button" onClick={disconnectWallet}>
            Disconnect
          </button>
        </>
      ) : (
        <>
          <span className="wallet-status-text">Wallet not connected</span>
          <button
            className="wallet-status-button"
            onClick={connectWallet}
            disabled={loading}
          >
            {loading ? "Connecting..." : "Connect Wallet"}
          </button>
        </>
      )}
    </div>
  );
}
