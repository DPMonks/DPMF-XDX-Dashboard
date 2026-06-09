import { useEffect, useState } from "react";
import { api } from "../api";

// Address shortener
function shortAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 9)}******${addr.slice(-4)}`;
}

// Copy helper
function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
}

export default function TokenHolders() {
  const [holders, setHolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const batchSize = 50;

  async function load(nextOffset = 0) {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const data = await api.topHolders(batchSize, nextOffset);
      if (!data.length) {
        setHasMore(false);
        return;
      }

      // 🔥 Sort by XDX balance (highest → lowest)
      const sorted = data.sort(
        (a, b) => parseFloat(b.balance) - parseFloat(a.balance)
      );

      setHolders(prev => [...prev, ...sorted]);
      setOffset(nextOffset + batchSize);
    } catch (err) {
      console.error("Error loading holders:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(); // initial load
    const interval = setInterval(() => load(0), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let ticking = false;
    function handleScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const nearBottom =
          window.innerHeight + window.scrollY >=
          document.body.offsetHeight - 300;
        if (nearBottom) load(offset);
        ticking = false;
      });
    }
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [offset, holders]);

  return (
    <div className="holder-container">
      <ul className="holder-list">
        {holders.map((h, i) => (
          <li
            key={i}
            className="holder-item"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid rgba(255,255,255,0.1)", // faint grey line
              padding: "8px 0"
            }}
          >
            <span style={{ width: "5%", textAlign: "left" }}>{i + 1}.</span>
            <span style={{ width: "45%", textAlign: "left" }}>
              {shortAddress(h.account)}
            </span>
            <span
              style={{
                width: "30%",
                textAlign: "center", // centred balance
                fontWeight: "500"
              }}
            >
              {parseFloat(h.balance).toLocaleString()} XDX
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
      {!hasMore && (
        <p style={{ textAlign: "center", opacity: 0.6 }}>All holders loaded</p>
      )}
    </div>
  );
}
