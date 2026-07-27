// src/components/WalletModal.jsx
import { useWallet } from "../context/WalletContext";
import "../App.css";

export default function WalletModal() {
  const {
    modalOpen,
    qrUrl,
    mobileUrl,
    cancelConnect
  } = useWallet();

  if (!modalOpen) return null;

  return (
    <div className="wallet-modal-overlay">
      <div className="wallet-modal neon-border">

        <h2 className="modal-title">Connect Wallet</h2>

        {/* QR CODE */}
        {qrUrl ? (
          <img
            src={qrUrl}
            alt="Xaman QR"
            className="qr-image"
            style={{
              width: "220px",
              height: "220px",
              marginBottom: "20px",
              borderRadius: "12px"
            }}
          />
        ) : (
          <p className="loading-text">Generating QR…</p>
        )}

        {/* MOBILE DEEP LINK */}
        {mobileUrl && (
          <a
            href={mobileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mobile-link-btn"
          >
            Open in Xaman (Mobile)
          </a>
        )}

        {/* CANCEL BUTTON */}
        <button
          className="cancel-wallet-btn"
          onClick={cancelConnect}
        >
          Cancel
        </button>

      </div>
    </div>
  );
}
