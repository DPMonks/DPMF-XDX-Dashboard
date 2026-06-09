import { useEffect, useState } from "react";
import { api } from "../api";

function shortAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 9)}******${addr.slice(-4)}`;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
}

export default function TokenHolders() {
  const [holders, setHolders] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.topHolders(); // backend returns full sorted list
      setHolders(data);
    } catch (err) {
      console.error("Error loading holders:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="holder-container">
      <ul className="holder-list">
        {holders.map((h) => (
          <li
            key={h.account}
            className="holder-item"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              padding: "8px 0"
            }}
          >
            {/* FIXED: Rank restored */}
            <span style={{ width: "5%", textAlign: "left" }}>{h.rank}.</span>

            <span style={{ width: "45%", textAlign: "left" }}>
              {shortAddress(h.account)}
            </span>

            <span
              style={{
                width: "30%",
                textAlign: "center",
                fontWeight: "500"
              }}
            >
              {Number(h.balance).toLocaleString()} XDX
            </span>

            <button
              className="copy-btn"
              onClick={() => copyToClipboard(h.account)}
              style={{
                width: "120px",
                backgroundColor: "#00e0ff",
                color: "#000",
                border: "none",
                borderRadius: "4px",
                padding: "6px 10px",
                cursor: "pointer",
                fontWeight: "600"
              }}
            >
              Copy Address
            </button>
          </li>
        ))}
      </ul>

      {loading && <p style={{ textAlign: "center" }}>Loading…</p>}
    </div>
  );
}
