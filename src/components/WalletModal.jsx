import xamanLogo from "../assets/XAMAN.jpg";
import { isPhoneDevice, xamanAppUrl, xamanSignUrl } from "../xaman/xamanClient";
import { useI18n } from "../i18n/useI18n";

export default function WalletModal({
  visible,
  qrUrl,
  mobileUrl,
  uuid,
  status,
  preparingLabel,
  scanLabel,
  onClose,
}) {
  const { t } = useI18n();
  if (!visible) return null;

  const phone = isPhoneDevice();
  const appHref = xamanAppUrl(uuid) || mobileUrl;
  const webHref = xamanSignUrl(uuid) || mobileUrl;
  const connectLabel = t.connectXaman || t.openApp;
  const heading =
    status === "loading"
      ? preparingLabel || t.preparing
      : phone
        ? connectLabel
        : scanLabel || t.scan;

  function closeOverlay(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.target === event.currentTarget) onClose?.();
  }

  return (
    <div className="wallet-modal-overlay" onPointerDown={closeOverlay} onClick={(event) => event.stopPropagation()}>
      <div
        className="wallet-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-modal-title"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <img src={xamanLogo} alt="" className="wallet-modal-logo" />
        <h2 id="wallet-modal-title" className="modal-title">
          {heading}
        </h2>

        {!phone && qrUrl && status !== "loading" ? (
          <img src={qrUrl} alt={t.xamanQr || t.scan} className="qr-image" />
        ) : null}

        {phone && status !== "loading" && (appHref || webHref) ? (
          <>
            {appHref ? (
              <a href={appHref} className="mobile-link-btn">
                {connectLabel}
              </a>
            ) : null}
            {webHref ? (
              <a
                href={webHref}
                className="mobile-link-btn is-web"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.openXamanWeb || t.openApp}
              </a>
            ) : null}
            <p className="wallet-modal-hint">{t.waitingXaman}</p>
          </>
        ) : null}

        <button type="button" onClick={onClose} className="cancel-wallet-btn">
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
