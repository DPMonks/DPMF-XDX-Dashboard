import React from "react";

export default function Header({ account }) {
  return (
    <div
      style={{
        width: "100%",
        background: "#0d0d0d",
        padding: "16px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid #222",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 999,
      }}
    >
      {/* LEFT SIDE — TITLE */}
      <div style={{ color: "#fff", fontSize: "20px", fontWeight: "bold" }}>
        DPMF‑XDX Dashboard
      </div>

      {/* RIGHT SIDE — WALLET STATUS */}
      {account ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "#111",
            padding: "10px 16px",
            borderRadius: "10px",
            border: "1px solid #333",
          }}
        >
          {/* Flashing green dot */}
          <span
            style={{
              color: "#00ff6a",
              fontWeight: "bold",
              fontSize: "18px",
              animation: "pulseOnline 1.2s infinite ease-in-out",
            }}
          >
            ●
          </span>

          {/* Wallet address */}
          <span
            style={{
              color: "#00eaff",
              fontSize: "16px",
              fontWeight: "bold",
              letterSpacing: "0.03em",
            }}
          >
            {account.slice(0, 6)}...{account.slice(-4)}
          </span>
        </div>
      ) : (
        <div
          style={{
            color: "#aaa",
            fontSize: "16px",
            background: "#111",
            padding: "10px 16px",
            borderRadius: "10px",
            border: "1px solid #333",
          }}
        >
          Not Connected
        </div>
      )}
    </div>
  );
}
