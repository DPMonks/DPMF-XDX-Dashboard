import { useWallet } from "../context/WalletContext";
import xamanLogo from "/assets/XAMAN.jpg"; // <-- Correct file name + correct path

export default function ConnectWallet() {
  const { walletAddress, connectWallet, disconnectWallet } = useWallet();

  return (
    <div className="xaman-topright-box">
      <img src={xamanLogo} alt="Xaman" className="xaman-topright-logo" />

      {!walletAddress ? (
        <button className="connect-wallet-btn" onClick={connectWallet}>
          Connect Wallet
        </button>
      ) : (
        <div className="wallet-connected">
          <p className="wallet-address">
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </p>

          <button className="disconnect-wallet-btn" onClick={disconnectWallet}>
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
