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
    document.body.classList.add("aim-drawer-open");
    return () => {
      document.body.style.overflow = prev;
      document.body.classList.remove("aim-drawer-open");
    };
  }, [open]);

  function openFromUi() {
    // Paint closed (off-screen) first, then slide in — avoids a pop-in.
    setDragging(false);
    if (open) {
      openAimOverlay();
      setOpenPanel(true);
      return;
    }
    setOpen(false);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        openAimOverlay();
        setOpenPanel(true);
      });
    });
  }

  function closeFromUi() {
    closeAimOverlay();
    setOpenPanel(false);
  }

  function onHeadTouchStart(event) {
    if (!open) return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    touchRef.current = { x: touch.clientX, y: touch.clientY, axis: null, dx: 0 };
  }

  function onHeadTouchMove(event) {
    const start = touchRef.current;
    const touch = event.changedTouches?.[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (!start.axis) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      start.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (start.axis === "y") {
        touchRef.current = null;
        if (dragging) setDragging(false);
        if (dragX) setDragX(0);
        return;
      }
      setDragging(true);
    }
    if (start.axis !== "x") return;
    const next = dx > 0 ? dx : 0;
    start.dx = next;
    if (next !== dragX) setDragX(next);
  }

  function onHeadTouchEnd() {
    const start = touchRef.current;
    const dx = start?.dx ?? dragX;
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
        <span className="aim-edge-tab-label">AI-Matrix</span>
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
        >
          <header
            className="aim-drawer-head"
            onTouchStart={onHeadTouchStart}
            onTouchMove={onHeadTouchMove}
            onTouchEnd={onHeadTouchEnd}
            onTouchCancel={onHeadTouchEnd}
          >
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
