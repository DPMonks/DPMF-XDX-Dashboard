import xamanLogo from "../assets/XAMAN.jpg";
import { useI18n } from "../i18n/useI18n";

export default function WalletButton({
  onClick,
  disabled,
  connected = false,
  address,
  label,
  title,
}) {
  const { t } = useI18n();
  const caption = label || (connected ? `${t.connected} ${address}` : t.connectWallet);

  return (
    <button
      type="button"
      className={connected && !label ? "connect-wallet-btn is-connected" : "connect-wallet-btn"}
      onClick={onClick}
      disabled={disabled}
      title={title || (connected ? t.disconnect : t.connectWallet)}
    >
      <img src={xamanLogo} alt="" className="wallet-btn-logo" />
      {connected && !label ? (
        <>
          <span className="wallet-status-online" aria-hidden="true">
            ●
          </span>
          <span>
            {t.connected} {address}
          </span>
        </>
      ) : (
        <span>{caption}</span>
      )}
    </button>
  );
}
