import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/useI18n";
import {
  AIM_MATRIX_ID,
  AIM_OVERLAY_EVENT,
  closeAimOverlay,
  openAimOverlay,
  readJumpHash,
} from "../siteJump";
import AiMatrixPanel from "./AiMatrixPanel";

const SWIPE_CLOSE_PX = 72;

export default function AiMatrixDrawer() {
  const { t } = useI18n();
  const [open, setOpen] = useState(() =>
    typeof window === "undefined" ? false : readJumpHash(window.location.hash) === AIM_MATRIX_ID
  );
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const touchRef = useRef(null);
  const openRef = useRef(open);
  openRef.current = open;

  const syncHash = useCallback((wantOpen) => {
    if (typeof window === "undefined" || !window.history?.replaceState) return;
    const onAim = readJumpHash(window.location.hash) === AIM_MATRIX_ID;
    if (wantOpen && !onAim) {
      window.history.replaceState(null, "", `#${AIM_MATRIX_ID}`);
      return;
    }
    if (!wantOpen && onAim) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const setOpenPanel = useCallback(
    (wantOpen) => {
      setOpen(Boolean(wantOpen));
      setDragX(0);
      setDragging(false);
      syncHash(Boolean(wantOpen));
    },
    [syncHash]
  );

  useEffect(() => {
    function onAim(event) {
      const next = event?.detail?.open;
      if (typeof next !== "boolean") return;
      setOpen(next);
      setDragX(0);
      setDragging(false);
      syncHash(next);
    }
    function onHash() {
      const want = readJumpHash(window.location.hash) === AIM_MATRIX_ID;
      setOpen(want);
      if (!want) {
        setDragX(0);
        setDragging(false);
      }
    }
    window.addEventListener(AIM_OVERLAY_EVENT, onAim);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener(AIM_OVERLAY_EVENT, onAim);
      window.removeEventListener("hashchange", onHash);
    };
  }, [syncHash]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape" && openRef.current) {
        event.preventDefault();
        closeAimOverlay();
        setOpenPanel(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpenPanel]);

  useEffect(() => {
    if (!open) return undefined;
    const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;
    if (!mobile) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function openFromUi() {
    openAimOverlay();
    setOpenPanel(true);
  }

  function closeFromUi() {
    closeAimOverlay();
    setOpenPanel(false);
  }

  function onTouchStart(event) {
    if (!open) return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    touchRef.current = { x: touch.clientX, y: touch.clientY };
    setDragging(true);
  }

  function onTouchMove(event) {
    const start = touchRef.current;
    const touch = event.changedTouches?.[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
      touchRef.current = null;
      setDragging(false);
      setDragX(0);
      return;
    }
    if (dx > 0) setDragX(dx);
  }

  function onTouchEnd() {
    const dx = dragX;
    touchRef.current = null;
    setDragging(false);
    if (dx >= SWIPE_CLOSE_PX) {
      closeFromUi();
      return;
    }
    setDragX(0);
  }

  const panelStyle =
    open && dragX > 0
      ? { transform: `translate3d(${dragX}px, 0, 0)` }
      : undefined;

  return (
    <>
      <button
        type="button"
        className={`aim-edge-tab${open ? " is-open" : ""}`}
        aria-controls="ai-matrix"
        aria-expanded={open}
        aria-label={t.aiMatrix || "AI-Matrix"}
        onClick={openFromUi}
      >
        <span className="aim-edge-tab-label">{t.jumpAim || "AI-Matrix"}</span>
        <span className="aim-edge-tab-short" aria-hidden="true">
          AIM
        </span>
      </button>

      <div
        className={`aim-drawer-root${open ? " is-open" : ""}${dragging ? " is-dragging" : ""}`}
        aria-hidden={!open}
      >
        <button
          type="button"
          className="aim-drawer-backdrop"
          tabIndex={open ? 0 : -1}
          aria-label={t.close || "Close"}
          onClick={closeFromUi}
        />
        <aside
          id="ai-matrix"
          className="aim-drawer-panel neon-card"
          role="dialog"
          aria-modal="true"
          aria-label={t.aiMatrix || "AI-Matrix"}
          style={panelStyle}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <header className="aim-drawer-head">
            <div className="aim-drawer-head-copy">
              <p className="aim-drawer-kicker">{t.jumpAim || "AIM"}</p>
              <h2 className="aim-drawer-title">{t.aiMatrix || "AI-Matrix"}</h2>
            </div>
            <button type="button" className="aim-drawer-close" onClick={closeFromUi}>
              {t.close || "Close"}
            </button>
          </header>
          <div className="aim-drawer-body">
            <AiMatrixPanel />
          </div>
        </aside>
      </div>
    </>
  );
}
