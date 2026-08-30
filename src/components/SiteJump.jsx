import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "../i18n/useI18n";
import {
  SITE_JUMP_IDS,
  jumpLockOffset,
  pageTravelPercent,
  readJumpHash,
  sectionAtLockLine,
  siteJumpItems,
} from "../siteJump";

function lockOffset() {
  const jump = document.querySelector(".site-jump");
  const bar = jump?.querySelector(".site-jump-bar");
  if (!bar) return 64;
  const style = getComputedStyle(jump);
  const offset = jumpLockOffset({
    barH: bar.getBoundingClientRect().height,
    safeTop: Number.parseFloat(style.top) || 0,
    gap: (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0),
  });
  document.documentElement.style.setProperty("--jump-sticky", `${offset}px`);
  return offset;
}

function scrollToDeck(id) {
  const node = document.getElementById(id);
  if (!node) return;
  function go() {
    const top = window.scrollY + node.getBoundingClientRect().top - lockOffset();
    if (Math.abs(node.getBoundingClientRect().top - lockOffset()) <= 1) return;
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
  }
  go();
  window.requestAnimationFrame(go);
  window.setTimeout(go, 300);
  window.setTimeout(go, 900);
  window.setTimeout(go, 1800);
  if (typeof ResizeObserver !== "function") return;
  const obs = new ResizeObserver(go);
  obs.observe(document.documentElement);
  window.setTimeout(() => obs.disconnect(), 2500);
}

export default function SiteJump({ ids = SITE_JUMP_IDS } = {}) {
  const { t } = useI18n();
  const uid = useId().replace(/:/g, "");
  const boxRef = useRef(null);
  const deckKey = (Array.isArray(ids) && ids.length ? ids : SITE_JUMP_IDS).join(",");
  const decks = deckKey.split(",");
  const [open, setOpen] = useState(false);
  const [locking, setLocking] = useState("");
  const [active, setActive] = useState(() =>
    typeof window === "undefined" ? decks[0] : readJumpHash(window.location.hash) || decks[0]
  );
  const [travel, setTravel] = useState(0);
  const items = siteJumpItems(t).filter((row) => decks.includes(row.id));
  const here = items.find((row) => row.id === active) || items[0];

  useEffect(() => {
    function onDoc(event) {
      if (boxRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    function read() {
      frame = 0;
      const next = sectionAtLockLine(deckKey.split(","), lockOffset());
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setActive((current) => (current === next ? current : next));
      setTravel(pageTravelPercent(window.scrollY, max));
    }
    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(read);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const boot = window.requestAnimationFrame(onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.cancelAnimationFrame(boot);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [deckKey]);

  useEffect(() => {
    const want = readJumpHash(window.location.hash);
    if (want) scrollToDeck(want);
    function onHash() {
      const next = readJumpHash(window.location.hash);
      if (!next) return;
      setActive(next);
      scrollToDeck(next);
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function lockOn(id) {
    setLocking(id);
    setActive(id);
    setOpen(false);
    if (window.history?.replaceState) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${id}`);
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => scrollToDeck(id));
    });
    window.setTimeout(() => setLocking(""), 700);
  }

  return (
    <nav className={`site-jump${open ? " is-open" : ""}`} aria-label={t.jumpTo || "Jump to"} ref={boxRef}>
      <div className="site-jump-bar">
        <button
          type="button"
          className="site-jump-now"
          aria-expanded={open}
          aria-controls={`${uid}-decks`}
          onClick={() => setOpen((on) => !on)}
        >
          <span className="site-jump-pip" aria-hidden="true" />
          <span className="site-jump-copy">
            <small>{t.jumpHere || "Now in"}</small>
            <b>{here.short}</b>
          </span>
          <span className="site-jump-chevron" aria-hidden="true" />
        </button>
        <div className="site-jump-travel" aria-hidden="true">
          <i style={{ width: `${travel}%` }} />
        </div>
      </div>

      <div className="site-jump-panel" id={`${uid}-decks`} hidden={!open}>
        <p className="site-jump-kicker">{t.jumpTo || "Jump to"}</p>
        <p className="site-jump-hint">{t.jumpHint || "Pick a deck. The page locks on and slides there."}</p>
        <div className="site-jump-grid" role="list">
          {items.map((row, index) => {
            const on = row.id === active;
            return (
              <button
                key={row.id}
                type="button"
                role="listitem"
                className={`${on ? "is-on" : ""}${locking === row.id ? " is-locking" : ""}`}
                aria-current={on ? "location" : undefined}
                title={row.label}
                onClick={() => lockOn(row.id)}
              >
                <em>{String(index + 1).padStart(2, "0")}</em>
                <span>{row.short}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
