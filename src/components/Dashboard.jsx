// src/components/Dashboard.jsx

import React from "react";

export default function Dashboard({ walletAddress }) {
  return (
    <div
      style={{
        marginTop: "90px", // ensures it sits below the fixed header
        padding: "24px",
        color: "#fff",
        minHeight: "100vh",
        background: "#0b0b0b",
      }}
    >
      <h1
        style={{
          fontSize: "28px",
          fontWeight: "600",
          marginBottom: "20px",
          color: "#00ffcc",
        }}
      >
        Dashboard Overview
      </h1>

      {/* Wallet Status */}
      <div
        style={{
          background: "#111",
          padding: "20px",
          borderRadius: "12px",
          border: "1px solid #222",
          marginBottom: "24px",
        }}
      >
        {walletAddress ? (
          <div>
            <h2 style={{ marginBottom: "10px", color: "#00c853" }}>
              Wallet Connected
            </h2>
            <p style={{ fontSize: "16px", opacity: 0.85 }}>
              Address: <strong>{walletAddress}</strong>
            </p>
          </div>
        ) : (
          <div>
            <h2 style={{ marginBottom: "10px", color: "#aaa" }}>
              Wallet Not Connected
            </h2>
            <p style={{ fontSize: "16px", opacity: 0.85 }}>
              Connect your wallet to view balances, pools, LP positions and
              charts.
            </p>
          </div>
        )}
      </div>

      {/* Placeholder for future components */}
      <div
        style={{
          background: "#111",
          padding: "20px",
          borderRadius: "12px",
          border: "1px solid #222",
        }}
      >
        <h2 style={{ marginBottom: "10px", color: "#fff" }}>
          Metrics & Analytics
        </h2>
        <p style={{ opacity: 0.75 }}>
          Your charts, pool stats, AMM data, LP positions and balances will be
          displayed here once integrated.
        </p>
      </div>
    </div>
  );
}
