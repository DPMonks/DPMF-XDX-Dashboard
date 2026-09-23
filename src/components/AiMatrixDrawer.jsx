import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/useI18n";
import {
  AIM_MATRIX_ID,
  AIM_OVERLAY_EVENT,
  closeAimOverlay,
  openAimOverlay,
  readJumpHash,
} from "../siteJump";
import Skeleton from "./Skeleton";
import { setAimPageFrozen } from "../pageLive";
import "../aim-matrix.css";

const AiMatrixPanel = lazy(() => import("./AiMatrixPanel"));
const AimDeskSmartChart = lazy(() => import("./AimDeskSmartChart"));

const SWIPE_CLOSE_PX = 72;

function useIsMobileAim(breakpoint = 900) {
  const [mobile, setMobile] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia(`(max-width: ${breakpoint}px)`).matches
  );
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setMobile(mq.matches);
    onChange();
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, [breakpoint]);
  return mobile;
}

export default function AiMatrixDrawer() {
  const { t } = useI18n();
  const isMobile = useIsMobileAim(900);
  const [open, setOpen] = useState(() =>
    typeof window === "undefined" ? false : readJumpHash(window.location.hash) === AIM_MATRIX_ID
  );
  // Hydrate AIM panel/chart only after first open so decks paint without AIM/Commander work.
  const [contentReady, setContentReady] = useState(() =>
    typeof window === "undefined" ? false : readJumpHash(window.location.hash) === AIM_MATRIX_ID
  );
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [chartProps, setChartProps] = useState({ deskOrders: [], estimate: null, extraPairs: [] });
  const handleChartPropsChange = useCallback((next) => {
    setChartProps((prev) => {
      const deskOrders = next?.deskOrders || [];
      const estimate = next?.estimate || null;
      const extraPairs = Array.isArray(next?.extraPairs) ? next.extraPairs : [];
      try {
        if (
          JSON.stringify(prev.deskOrders) === JSON.stringify(deskOrders) &&
          JSON.stringify(prev.estimate) === JSON.stringify(estimate) &&
          JSON.stringify(prev.extraPairs || []) === JSON.stringify(extraPairs)
        ) {
          return prev;
        }
      } catch {
        /* replace below */
      }
      return { deskOrders, estimate, extraPairs };
    });
  }, []);
  if (open && !contentReady) setContentReady(true);
  const touchRef = useRef(null);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

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
    if (!open) {
      setAimPageFrozen(false);
      document.body.classList.remove("aim-drawer-open", "aim-mobile");
      return undefined;
    }
    document.body.classList.add("aim-drawer-open");
    if (isMobile) {
      document.body.classList.add("aim-mobile");
      setAimPageFrozen(true);
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const prev = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        top: document.body.style.top,
        width: document.body.style.width,
        left: document.body.style.left,
        right: document.body.style.right,
      };
      // iOS-safe lock: fixed body so underlying page cannot steal scroll / hide chrome.
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      const onTouchMove = (event) => {
        let el = event.target;
        if (el && el.nodeType === 3) el = el.parentElement;
        if (el && typeof el.closest === "function") {
          if (
            el.closest(
              ".aim-drawer-body, .aim-chat-log, .hybrid-pairs, .hybrid-topbar, .hybrid-ranges, .aim-desk-chart-tfs, .aim-drawer-panel"
            )
          ) {
            return;
          }
        }
        if (event.cancelable) event.preventDefault();
      };
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      return () => {
        document.removeEventListener("touchmove", onTouchMove);
        document.body.style.overflow = prev.overflow;
        document.body.style.position = prev.position;
        document.body.style.top = prev.top;
        document.body.style.width = prev.width;
        document.body.style.left = prev.left;
        document.body.style.right = prev.right;
        document.body.classList.remove("aim-drawer-open", "aim-mobile");
        setAimPageFrozen(false);
        window.scrollTo(0, scrollY);
      };
    }
    setAimPageFrozen(false);
    document.body.classList.remove("aim-mobile");
    return () => {
      document.body.classList.remove("aim-drawer-open", "aim-mobile");
      setAimPageFrozen(false);
    };
  }, [open, isMobile]);

  // Mobile AIM: land at top once when opening (do not keep fighting user scroll).
  useEffect(() => {
    if (!open || !isMobile) return undefined;
    let cancelled = false;
    const scrollAimTop = () => {
      if (cancelled) return;
      const body = document.querySelector(".aim-drawer-body");
      if (body) body.scrollTop = 0;
    };
    scrollAimTop();
    const raf = window.requestAnimationFrame(scrollAimTop);
    const t1 = window.setTimeout(scrollAimTop, 80);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
    };
    // intentionally only when open flips on mobile, not on every contentReady tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isMobile]);

  function openFromUi() {
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
      if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return;
      start.axis = Math.abs(dx) > Math.abs(dy) * 1.35 ? "x" : "y";
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

  const showDesktopChart = open && !isMobile;
  const showInlineChart = open && isMobile;

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
        className={`aim-drawer-root${open ? " is-open" : ""}${dragging ? " is-dragging" : ""}${showDesktopChart ? " has-chart-pane" : ""}`}
        aria-hidden={!open}
      >
        <button
          type="button"
          className="aim-drawer-backdrop"
          tabIndex={open ? 0 : -1}
          aria-label={t.close || "Close"}
          onClick={closeFromUi}
        />
        {showDesktopChart && contentReady ? (
          <div className="aim-drawer-chart-pane" aria-label="Merged trading chart">
            <Suspense fallback={<Skeleton height={420} />}>
              <AimDeskSmartChart
                deskOrders={chartProps.deskOrders}
                estimate={chartProps.estimate}
                extraPairs={chartProps.extraPairs}
                fillHeight
              />
            </Suspense>
          </div>
        ) : null}
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
            {contentReady ? (
              <Suspense fallback={<Skeleton height={320} />}>
                <AiMatrixPanel
                  onChartPropsChange={handleChartPropsChange}
                  showInlineChart={showInlineChart}
                  open={open}
                />
              </Suspense>
            ) : null}
          </div>
        </aside>
      </div>
    </>
  );
}
