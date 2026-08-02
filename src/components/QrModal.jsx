import React from "react";

export default function QrModal({ qr, onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "12px",
          textAlign: "center",
          maxWidth: "90%",
          boxShadow: "0 0 20px rgba(0,0,0,0.4)"
        }}
      >
        <h2 style={{ marginBottom: "15px" }}>Scan with Xaman</h2>

        <img
          src={qr}
          alt="Xaman QR Code"
          style={{
            width: "260px",
            height: "260px",
            borderRadius: "8px"
          }}
        />

        <button
          onClick={onClose}
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            background: "#333",
            color: "#fff",
            cursor: "pointer",
            fontSize: "16px"
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
