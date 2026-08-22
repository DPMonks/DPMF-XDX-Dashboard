import xamanLogo from "../assets/XAMAN.jpg";
import { isPhoneDevice, xamanAppUrl, xamanSignUrl } from "../xaman/xamanClient";
import { useI18n } from "../i18n/useI18n";

export default function WalletModal({
  visible,
  qrUrl,
  mobileUrl,
  uuid,
  status,
  onClose,
}) {
  const { t } = useI18n();
  if (!visible) return null;

  const phone = isPhoneDevice();
  const appHref = xamanAppUrl(uuid) || mobileUrl;
  const webHref = xamanSignUrl(uuid) || mobileUrl;
  const connectLabel = t.connectXaman || t.openApp;

  function openXaman(event) {
    if (!appHref && !webHref) return;
    event.preventDefault();
    if (appHref) window.location.href = appHref;
    if (webHref && webHref !== appHref) {
      window.setTimeout(() => {
        if (document.visibilityState === "visible") {
          window.location.href = webHref;
        }
      }, 700);
    }
  }

  return (
    <div className="wallet-modal-overlay" onClick={onClose}>
      <div
        className="wallet-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <img src={xamanLogo} alt="" className="wallet-modal-logo" />
        <h2 id="wallet-modal-title" className="modal-title">
          {status === "loading"
            ? t.preparing
            : phone
              ? connectLabel
              : t.scan}
        </h2>

        {!phone && qrUrl && status !== "loading" ? (
          <img src={qrUrl} alt={t.xamanQr || t.scan} className="qr-image" />
        ) : null}

        {phone && status !== "loading" && (appHref || webHref) ? (
          <a
            href={webHref || appHref}
            className="mobile-link-btn"
            onClick={openXaman}
          >
            {connectLabel}
          </a>
        ) : null}

        <button type="button" onClick={onClose} className="cancel-wallet-btn">
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
