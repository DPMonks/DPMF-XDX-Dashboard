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
  const pageSize = 50;

  async function load() {
    const data = await api.topHolders(500); // load more, paginate locally
    const sorted = data.sort((a, b) => b.balance - a.balance);
    setHolders(sorted);
  }

  useEffect(() => {
    load(); // initial load
    const interval = setInterval(load, 10000); // smooth auto-refresh
    return () => clearInterval(interval);
  }, []);

  const paginated = holders.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(holders.length / pageSize);

  return (
    <div className="holder-container">

      <ul className="holder-list">
        {paginated.map((h, i) => (
          <li key={i} className="holder-item">
            <span>{(page - 1) * pageSize + i + 1}.</span>

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

      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>
          Prev
        </button>

        <span>Page {page} / {totalPages}</span>

        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
          Next
        </button>
      </div>

    </div>
  );
}
