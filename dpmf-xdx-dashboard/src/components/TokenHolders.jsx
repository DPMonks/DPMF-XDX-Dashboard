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
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const pageSize = 50;

  async function load(offset = 0) {
    setLoading(true);
    try {
      // 🔥 Infinite scroll: fetch 50 at a time
      const data = await api.topHolders(50, offset);
      // 🔥 Numeric sort (fixes rank issue)
      const sorted = data.sort(
        (a, b) => parseFloat(b.balance) - parseFloat(a.balance)
      );
      // 🔥 Append new data instead of replacing
      setHolders(prev => [...prev, ...sorted]);
    } catch (err) {
      console.error("Error loading holders:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(); // initial load
    const interval = setInterval(() => load(0), 10000); // smooth auto-refresh
    return () => clearInterval(interval);
  }, []);

  // 🔥 Infinite scroll trigger
  useEffect(() => {
    function handleScroll() {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 200
      ) {
        // Load next batch when near bottom
        const nextOffset = holders.length;
        load(nextOffset);
      }
    }
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [holders]);

  const paginated = holders.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(holders.length / pageSize);

  return (
    <div className="holder-container">
      <ul className="holder-list">
        {paginated.map((h, i) => (
          <li key={i} className="holder-item">
            <span>{(page - 1) * pageSize + i + 1}.</span>
            <span>{shortAddress(h.account)}</span>
            {/* 🔥 Removed negative sign */}
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

      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>
          Prev
        </button>
        <span>
          Page {page} / {totalPages}
        </span>
        <button
          disabled={page === totalPages}
          onClick={() => setPage(p => p + 1)}
        >
          Next
        </button>
      </div>

      {loading && <p style={{ textAlign: "center" }}>Loading…</p>}
    </div>
  );
}
