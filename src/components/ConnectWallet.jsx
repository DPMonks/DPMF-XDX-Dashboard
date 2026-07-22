import React, { useState } from "react";
import { createPayload } from "../xaman/xamanClient";
import WalletModal from "./WalletModal";
import xamanLogo from "../assets/Xaman.jpg";

export default function ConnectWallet({ onSignedIn }) {
  const [qrUrl, setQrUrl] = useState(null);
  const [mobileUrl, setMobileUrl] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleConnect = async () => {
    const response = await createPayload();

    // QR + mobile deep link
    setQrUrl(response.refs.qr_png);
    setMobileUrl(response.refs.deeplink_web);

    // Show modal
    setModalVisible(true);

    // Auto‑close after 30 seconds (payload expiry)
    const timeout = setTimeout(() => {
      setModalVisible(false);
    }, 30000);

    // Listener: auto-close when signed in
    const subscription = await response.created;

    subscription.on("signed", (event) => {
      clearTimeout(timeout); // cancel timeout if signed
      const account = event.account;

      // Save globally for future features (trading, AMM, LP, etc.)
      window.userAccount = account;

      // Close modal
      setModalVisible(false);

      // Pass account to parent (App.jsx)
      if (onSignedIn) onSignedIn(account);
    });

    // Listener: payload expired
    subscription.on("expired", () => {
      clearTimeout(timeout);
      setModalVisible(false);
    });
  };

  return (
    <>
      <button
        onClick={handleConnect}
        style={{
          padding: "12px 20px",
          background: "#111",
          color: "#fff",
          borderRadius: "10px",
          border: "none",
          cursor: "pointer",
          fontSize: "16px",
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}
      >
        <img
          src={xamanLogo}
          alt="Xaman"
          style={{ width: "24px", height: "24px", borderRadius: "6px" }}
        />
        Connect Wallet
      </button>

      <WalletModal
        visible={modalVisible}
        qrUrl={qrUrl}
        mobileUrl={mobileUrl}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}
