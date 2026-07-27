import { useWallet } from "../context/WalletContext";

export default function Toast() {
  const { toast } = useWallet();

  if (!toast) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 30,
      right: 30,
      background: "#00eaff",
      color: "#000",
      padding: "12px 20px",
      borderRadius: 10,
      fontWeight: "bold",
      boxShadow: "0 0 20px #00eaff",
      zIndex: 99999
    }}>
      {toast}
    </div>
  );
}
