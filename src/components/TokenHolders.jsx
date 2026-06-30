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
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const LIMIT = 200;

  async function loadMore() {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const data = await api.topHolders(LIMIT, offset);

      if (data.length === 0) {
        setHasMore(false);
        return;
      }

      setHolders(prev => [...prev, ...data]);
      setOffset(prev => prev + LIMIT);
    } catch (err) {
      console.error("Error loading holders:", err);
    } finally {
      setLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    loadMore();
  }, []);

  // Auto-refresh every 10 seconds (refreshes from scratch)
  useEffect(() => {
    const interval = setInterval(() => {
      setHolders([]);
      setOffset(0);
      setHasMore(true);
      loadMore();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Infinite scroll trigger
  useEffect(() => {
    function handleScroll() {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 200
      ) {
        loadMore();
      }
    }

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [holders, hasMore]);

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
      {!hasMore && <p style={{ textAlign: "center" }}>All holders loaded</p>}
    </div>
  );
}
