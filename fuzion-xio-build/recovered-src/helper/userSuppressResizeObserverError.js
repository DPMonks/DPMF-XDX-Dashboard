import { useEffect } from "react";

export function useSuppressResizeObserverError() {
  useEffect(() => {
    const errorHandler = (e) => {
      if (
        e.message ===
          "ResizeObserver loop completed with undelivered notifications." ||
        e.message === "ResizeObserver loop limit exceeded"
      ) {
        // ✅ Only silence console, don't stop observer propagation
        console.warn("Suppressed ResizeObserver error:", e.message);
        return;
      }
    };

    const rejectionHandler = (event) => {
      if (
        event.reason &&
        (event.reason.message ===
          "ResizeObserver loop completed with undelivered notifications." ||
          event.reason.message === "ResizeObserver loop limit exceeded")
      ) {
        console.warn(
          "Suppressed ResizeObserver rejection:",
          event.reason.message
        );
        event.preventDefault(); // this one is safe
      }
    };

    window.addEventListener("error", errorHandler);
    window.addEventListener("unhandledrejection", rejectionHandler);

    return () => {
      window.removeEventListener("error", errorHandler);
      window.removeEventListener("unhandledrejection", rejectionHandler);
    };
  }, []);
}
