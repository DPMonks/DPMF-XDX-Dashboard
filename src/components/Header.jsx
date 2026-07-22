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
      <div style={{ color: "#fff", fontSize: "20px", fontWeight: "bold" }}>
        DPMF‑XDX Dashboard
      </div>

      {account ? (
        <div
          style={{
            color: "#00c853",
            fontSize: "16px",
            fontWeight: "bold",
            background: "#111",
            padding: "10px 16px",
            borderRadius: "10px",
            border: "1px solid #333",
          }}
        >
          Connected: {account}
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
