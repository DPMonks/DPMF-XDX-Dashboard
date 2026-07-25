import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";                 // ← your new dashboard UI
import { WalletProvider } from "./context/WalletContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WalletProvider>
      <App />                           // ← render the neon dashboard
    </WalletProvider>
  </React.StrictMode>
);
