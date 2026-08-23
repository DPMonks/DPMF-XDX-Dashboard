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
  const confirming = status === "confirming";
  const heading =
    status === "loading"
      ? preparingLabel || t.preparing
      : confirming
        ? scanLabel || t.scan
        : phone
          ? connectLabel
          : scanLabel || t.scan;

  function closeOverlay(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.target === event.currentTarget) onClose?.();
  }

  function openXamanApp(event) {
    event.preventDefault();
    event.stopPropagation();
    if (appHref) window.location.href = appHref;
  }

  function openXamanWeb(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!webHref) return;
    window.open(webHref, "_blank", "noopener,noreferrer");
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

        {!phone && qrUrl && status !== "loading" && !confirming ? (
          <img src={qrUrl} alt={t.xamanQr || t.scan} className="qr-image" />
        ) : null}

        {phone && status !== "loading" && !confirming && (appHref || webHref) ? (
          <>
            {appHref ? (
              <button type="button" className="mobile-link-btn" onClick={openXamanApp}>
                {connectLabel}
              </button>
            ) : null}
            {webHref ? (
              <button type="button" className="mobile-link-btn is-web" onClick={openXamanWeb}>
                {t.openXamanWeb || t.openApp}
              </button>
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
