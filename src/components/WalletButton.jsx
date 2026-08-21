import xamanLogo from "../assets/XAMAN.jpg";

export default function WalletButton({ onClick, disabled, connected, address }) {
  return (
    <button
      type="button"
      className="connect-wallet-btn"
      onClick={onClick}
      disabled={disabled}
    >
      <img src={xamanLogo} alt="" className="wallet-btn-logo" />
      {connected ? `Connected ${address}` : "Connect Wallet"}
    </button>
  );
}
