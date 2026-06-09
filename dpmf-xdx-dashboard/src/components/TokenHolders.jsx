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

      const sorted = data.sort(
        (a, b) => parseFloat(b.balance) - parseFloat(a.balance)
      );

      // Append smoothly
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
    const interval = setInterval(() => {
      // refresh first batch only
      load(0);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // 🔥 Infinite scroll trigger (smooth, no jump)
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
          <li key={i} className="holder-item">
            <span>{i + 1}.</span>
            <span>{shortAddress(h.account)}</span>
            <span>{h.balance}</span>
            <button
              className="copy-btn"
              onClick={() => copyToClipboard(h.account)}
            >
              Copy
            </button>
          </li>
        ))}
      </ul>

      {loading && <p style={{ textAlign: "center" }}>Loading…</p>}
      {!hasMore && (
        <p style={{ textAlign: "center", opacity: 0.6 }}>
          All holders loaded
        </p>
      )}
    </div>
  );
}
