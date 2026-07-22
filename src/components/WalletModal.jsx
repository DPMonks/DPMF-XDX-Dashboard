import React from "react";

export default function WalletModal({ visible, qrUrl, mobileUrl, onClose }) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999
      }}
    >
      <div
        style={{
          background: "#0d0d0d",
          padding: "32px",
          borderRadius: "16px",
          width: "380px",
          textAlign: "center",
          boxShadow: "0 0 40px rgba(0,0,0,0.4)",
          animation: "fadeIn 0.25s ease-out"
        }}
      >
        <h2 style={{ color: "#fff", marginBottom: "20px" }}>
          Connect with Xaman
        </h2>

        {qrUrl && (
          <img
            src={qrUrl}
            alt="Xaman QR"
            style={{
              width: "260px",
              height: "260px",
              margin: "0 auto",
              borderRadius: "12px"
            }}
          />
        )}

        {/* Mobile sign-in button */}
        {mobileUrl && (
          <a
            href={mobileUrl}
            style={{
              display: "block",
              marginTop: "20px",
              padding: "12px 20px",
              background: "#00c853",
              color: "#000",
              borderRadius: "10px",
              textDecoration: "none",
              fontWeight: "bold"
            }}
          >
            Sign in with Xaman (Mobile)
          </a>
        )}

        {/* Cancel button */}
        <button
          onClick={onClose}
          style={{
            marginTop: "16px",
            padding: "12px 20px",
            width: "100%",
            background: "#222",
            color: "#fff",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            fontSize: "16px"
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
