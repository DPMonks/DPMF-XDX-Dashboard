// src/main.jsx

import React from "react";
import ReactDOM from "react-dom/client";
import XamanApp from "./XamanApp";
import { WalletProvider } from "./context/WalletContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WalletProvider>
      <XamanApp />
    </WalletProvider>
  </React.StrictMode>
);
