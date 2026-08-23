import { useEffect, useId, useMemo, useRef, useState } from "react";

export default function BrandSelect({
  value,
  options = [],
  onChange,
  ariaLabel,
  searchable = false,
  placeholder = "",
}) {
  const boxRef = useRef(null);
  const uid = useId().replace(/:/g, "");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = (Array.isArray(options) ? options : []).find((row) => row.id === value) || options[0];
  const matches = useMemo(() => {
    const rows = Array.isArray(options) ? options : [];
    const q = query.trim().toUpperCase();
    if (!q) return rows;
    return rows.filter((row) => String(row.label || row.id || "").toUpperCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    function onDoc(event) {
      if (!boxRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  function select(id) {
    onChange?.(id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className={`pair-select brand-select ${open ? "is-open" : ""}`} ref={boxRef}>
      <div className="pair-select-control">
        <input
          className="pair-select-input"
          type={searchable ? "search" : "text"}
          readOnly={!searchable}
          value={open && searchable ? query : selected?.label || ""}
          placeholder={placeholder || selected?.label || ""}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="listbox"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            if (!searchable) return;
            setQuery(event.target.value);
            setOpen(true);
          }}
          onClick={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
            if (event.key === "Enter" && matches[0]) select(matches[0].id);
          }}
        />
        <button
          type="button"
          className="pair-select-chevron"
          tabIndex={-1}
          aria-label={ariaLabel}
          onClick={() => setOpen((current) => !current)}
        >
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <path
              d="M4.2 7.2h11.6L10 14.2 4.2 7.2z"
              fill={`url(#${uid}-caret)`}
              stroke="#c770ff"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id={`${uid}-caret`} x1="4" y1="7" x2="16" y2="15" gradientUnits="userSpaceOnUse">
                <stop stopColor="#00eaff" />
                <stop offset="1" stopColor="#c770ff" />
              </linearGradient>
            </defs>
          </svg>
        </button>
      </div>
      {open ? (
        <ul className="pair-select-list" role="listbox">
          {matches.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={value === row.id ? "is-active" : ""}
                onClick={() => select(row.id)}
              >
                {row.label || row.id}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
