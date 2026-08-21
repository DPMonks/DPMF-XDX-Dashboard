export default function WalletModal({
  visible,
  qrUrl,
  mobileUrl,
  status,
  onClose,
}) {
  if (!visible) return null;

  return (
    <div className="wallet-modal-overlay">
      <div className="wallet-modal">
        <h2 className="modal-title">
          {status === "loading" ? "Preparing Xaman sign-in…" : "Scan with Xaman"}
        </h2>

        {qrUrl && status !== "loading" && (
          <img src={qrUrl} alt="Xaman QR" className="qr-image" />
        )}

        {mobileUrl && (
          <a href={mobileUrl} className="mobile-link-btn">
            Open in Xaman App
          </a>
        )}

        <button type="button" onClick={onClose} className="cancel-wallet-btn">
          Cancel
        </button>
      </div>
    </div>
  );
}
