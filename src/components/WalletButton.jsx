import xamanLogo from "../assets/XAMAN.jpg";
import { useI18n } from "../i18n/useI18n";

export default function WalletButton({ onClick, disabled, connected, address }) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      className={connected ? "connect-wallet-btn is-connected" : "connect-wallet-btn"}
      onClick={onClick}
      disabled={disabled}
      title={connected ? t.disconnect : t.connectWallet}
    >
      <img src={xamanLogo} alt="" className="wallet-btn-logo" />
      {connected ? (
        <>
          <span className="wallet-status-online" aria-hidden="true">
            ●
          </span>
          <span>
            {t.connected} {address}
          </span>
        </>
      ) : (
        <span>{t.connectWallet}</span>
      )}
    </button>
  );
}
