// src/components/WalletModal.jsx

import { useWallet } from "../context/WalletContext";

export default function WalletModal() {
  const { modalOpen, setModalOpen, qrUrl, loading } = useWallet();

  if (!modalOpen) return null;

  return (
    <div className="wallet-modal-backdrop">
      <div className="wallet-modal">

        <div className="wallet-modal-header">
          <h3>Connect Xaman Wallet</h3>
          <button
            className="wallet-modal-close"
            onClick={() => setModalOpen(false)}
          >
            ✕
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <p className="wallet-modal-hint">Generating secure QR...</p>
        )}

        {/* QR Code */}
        {qrUrl && !loading && (
          <div className="wallet-modal-body">
            <img
              id="orderQrImg"
              src={qrUrl}
              alt="Xaman QR"
              loading="eager"
              decoding="sync"
              fetchpriority="high"
              className="hightech-qr"
              style={{ width: "320px", height: "320px" }}
            />
            <p className="wallet-modal-hint">
              Scan with Xaman to authenticate.
            </p>
          </div>
        )}

        {/* Fallback */}
        {!loading && !qrUrl && (
          <p className="wallet-modal-hint">Preparing wallet session...</p>
        )}
      </div>
    </div>
  );
}
