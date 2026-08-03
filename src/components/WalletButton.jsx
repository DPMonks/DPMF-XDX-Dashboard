export default function WalletButton({ onClick }) {
  return (
    <button
      className="connect-wallet-btn"
      onClick={onClick}
      style={{
        padding: "12px 24px",
        background: "rgba(0,0,0,0.6)",
        border: "1px solid #00eaff",
        borderRadius: "10px",
        color: "#00eaff",
        fontWeight: "600",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "10px"
        // ❌ REMOVE zIndex COMPLETELY
      }}
    >
      Connect Wallet
    </button>
  );
}
