import { useWallet } from "../context/WalletContext";
import xamanLogo from "/assets/XAMAN.jpg?url";
import { Xumm } from "xumm";

const xumm = new Xumm("YOUR_XUMM_API_KEY");

export default function ConnectWallet() {
  const { walletAddress, setWalletAddress, disconnectWallet } = useWallet();

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

        // Store in your global wallet context
        setWalletAddress(userAccount);

        // Also store globally for future functions
        window.userAccount = userAccount;
      } else {
        console.warn("User cancelled sign-in");
      }
    } catch (err) {
      console.error("Xaman sign-in error:", err);
    }
  };

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
