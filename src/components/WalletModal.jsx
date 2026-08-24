import { useEffect, useRef } from "react";
import xamanLogo from "../assets/XAMAN.jpg";
import {
  isInAppBrowser,
  isPhoneDevice,
  isTelegramWebView,
  launchXamanSign,
  xamanAppUrl,
  xamanSignUrl,
} from "../xaman/xamanClient";
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
  const telegram = isTelegramWebView();
  const inApp = isInAppBrowser();
  const phone = isPhoneDevice() || inApp;
  const appHref = xamanAppUrl(uuid) || mobileUrl;
  const webHref = xamanSignUrl(uuid);
  const useUniversalLink = telegram || !phone;
  const connectHref = useUniversalLink ? webHref || appHref : appHref || webHref;
  const connectLabel = xapp ? t.xappApprove || t.connectXaman || t.openApp : t.connectXaman || t.openApp;
  const confirming = status === "confirming";
  const showQr = Boolean(!xapp && qrUrl && status !== "loading" && !confirming);
  const lastOpen = useRef(0);
  const showConnect = Boolean(!xapp && status !== "loading" && !confirming && (connectHref || uuid));
  const heading =
    status === "loading"
      ? preparingLabel || t.preparing
      : confirming
        ? scanLabel || t.scan
        : xapp
          ? connectLabel
          : showQr
            ? scanLabel || t.scan
            : connectLabel;

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
    event.stopPropagation();
    if (!uuid && !connectHref) {
      event.preventDefault();
      return;
    }
    const now = Date.now();
    if (now - lastOpen.current < 400) {
      event.preventDefault();
      return;
    }
    lastOpen.current = now;
    const result = launchXamanSign(uuid);
    if (result.opened) event.preventDefault();
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

        {showQr ? <img src={qrUrl} alt={t.xamanQr || t.scan} className="qr-image" /> : null}

        {xapp && status !== "loading" && !confirming ? (
          <p className="wallet-modal-hint">{t.xappApproveHint || t.waitingXaman}</p>
        ) : null}

        {showConnect ? (
          <>
            <a
              className="mobile-link-btn"
              href={connectHref}
              target={useUniversalLink ? "_blank" : undefined}
              rel="noopener noreferrer"
              onClick={openXamanApp}
              onTouchEnd={openXamanApp}
            >
              {connectLabel}
            </a>
            <p className="wallet-modal-hint">
              {telegram ? t.waitingXamanTelegram || t.waitingXaman : t.waitingXaman}
            </p>
          </>
        ) : !xapp && status !== "loading" && !confirming && showQr ? (
          <p className="wallet-modal-hint">{t.waitingXaman}</p>
        ) : null}

        <button type="button" onClick={onClose} className="cancel-wallet-btn">
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
