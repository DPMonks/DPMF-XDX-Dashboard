import { useWallet } from "../context/WalletContext";
import xamanLogo from "../assets/Xaman.jpg";

export default function ConnectWallet() {
  const {
    walletAddress,
    connectWallet,
    disconnectWallet
  } = useWallet();

  return (
    <>
      {!walletAddress ? (
        <button className="connect-wallet-btn" onClick={connectWallet}>
          <img src={xamanLogo} alt="Xaman" className="wallet-logo" />
          Connect Wallet
        </button>
      ) : (
        <div className="wallet-connected">
          <img src={xamanLogo} alt="Xaman" className="wallet-logo" />

          <span className="wallet-address">
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </span>

          <button className="disconnect-wallet-btn" onClick={disconnectWallet}>
            Disconnect
          </button>
        </div>
      )}
    </>
  );
}
