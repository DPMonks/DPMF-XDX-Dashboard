import { useWallet } from "../context/WalletContext";

export default function ConnectWallet() {
  const { walletAddress, connectWallet, disconnectWallet } = useWallet();

  return (
    <div className="wallet-box">
      {!walletAddress ? (
        <button className="connect-wallet-btn" onClick={connectWallet}>
          Connect Wallet
        </button>
      ) : (
        <div className="wallet-connected">
          <p>
            Connected:{" "}
            <strong>
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </strong>
          </p>

          <button className="disconnect-wallet-btn" onClick={disconnectWallet}>
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
