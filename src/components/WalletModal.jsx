import { useEffect } from "react";
import xamanLogo from "../assets/XAMAN.jpg";
import { isPhoneDevice, launchXamanSign, xamanAppUrl, xamanSignUrl } from "../xaman/xamanClient";
import { isXappHost } from "../xaman/xappHost";
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
  const xapp = isXappHost();
  const phone = xapp || isPhoneDevice();
  const appHref = xamanAppUrl(uuid) || mobileUrl;
  const webHref = xamanSignUrl(uuid) || mobileUrl;
  const connectLabel = xapp ? t.xappApprove || t.connectXaman || t.openApp : t.connectXaman || t.openApp;
  const confirming = status === "confirming";
  const heading =
    status === "loading"
      ? preparingLabel || t.preparing
      : confirming
        ? scanLabel || t.scan
        : xapp
          ? connectLabel
          : phone
            ? connectLabel
            : scanLabel || t.scan;

  useEffect(() => {
    if (!visible || !xapp || !uuid || status === "loading" || confirming) return undefined;
    launchXamanSign(uuid);
    return undefined;
  }, [visible, xapp, uuid, status, confirming]);

  if (!visible) return null;

  function closeOverlay(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.target === event.currentTarget) onClose?.();
  }

  function openXamanApp(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!uuid && !appHref && !webHref) return;
    launchXamanSign(uuid);
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

        {!phone && !xapp && qrUrl && status !== "loading" && !confirming ? (
          <img src={qrUrl} alt={t.xamanQr || t.scan} className="qr-image" />
        ) : null}

        {xapp && status !== "loading" && !confirming ? (
          <p className="wallet-modal-hint">{t.xappApproveHint || t.waitingXaman}</p>
        ) : null}

        {phone && !xapp && status !== "loading" && !confirming && (appHref || webHref) ? (
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
