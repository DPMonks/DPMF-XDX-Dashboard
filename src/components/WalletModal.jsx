import { useI18n } from "../i18n/useI18n";

export default function WalletModal({
  visible,
  qrUrl,
  mobileUrl,
  status,
  onClose,
}) {
  const { t } = useI18n();
  if (!visible) return null;

  return (
    <div className="wallet-modal-overlay" onClick={onClose}>
      <div
        className="wallet-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="modal-title">
          {status === "loading" ? t.preparing : t.scan}
        </h2>

        {qrUrl && status !== "loading" && (
          <img src={qrUrl} alt="Xaman QR" className="qr-image" />
        )}

        {mobileUrl && (
          <a href={mobileUrl} className="mobile-link-btn">
            {t.openApp}
          </a>
        )}

        <button type="button" onClick={onClose} className="cancel-wallet-btn">
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
