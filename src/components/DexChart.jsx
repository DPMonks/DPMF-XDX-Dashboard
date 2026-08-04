import { useEffect } from "react";
import "./DexChart.css";

export default function DexChart() {

  useEffect(() => {
    let reloads = 0;

    const frame = document.getElementById("dexFrame");
    const overlay = document.getElementById("dexLoading");
    const retryBtn = document.getElementById("retryBtn");

    // 6-second stuck-load protection
    let reloadTimeout = setTimeout(() => {
      if (reloads < 2) {
        reloads++;
        frame.src = frame.src;
      }
    }, 6000);

    // 12-second backup reload
    setTimeout(() => {
      if (reloads < 2) {
        reloads++;
        frame.src = frame.src;
      }
    }, 12000);

    // Hide overlay + Safari repaint fix
    frame.addEventListener("load", () => {
      clearTimeout(reloadTimeout);
      overlay.style.display = "none";

      frame.style.opacity = "0.99";
      setTimeout(() => (frame.style.opacity = "1"), 50);

      frame.style.pointerEvents = "auto";
    });

    // Retry button logic
    retryBtn.onclick = () => {
      frame.src = frame.src;
      retryBtn.style.display = "none";
    };

    // Show retry button if too many reloads
    setTimeout(() => {
      if (reloads >= 2) retryBtn.style.display = "block";
    }, 14000);

    // Fallback message if Dexscreener is down
    setTimeout(() => {
      if (overlay.style.display !== "none") {
        overlay.innerText =
          "Dexscreener is currently unavailable. Please try again later.";
      }
    }, 10000);

    // Reload on tab visibility change
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) frame.src = frame.src;
    });

    // Reload on DOM ready
    frame.src = frame.src;

    // Force-hide overlay after 8 seconds
    setTimeout(() => {
      overlay.style.display = "none";
    }, 8000);
  }, []);

  return (
    <div className="dex-wrapper">
      <div className="dex-shimmer"></div>

      <div className="dex-responsive">
        <iframe
          id="dexFrame"
          src="https://dexscreener.com/xrpl/xdx.rmjaxysbnzhwp7ffynasyp5ty3r9xnurpo_xrp?embed=1&theme=dark&info=0&trades=0"
          className="dex-iframe"
        ></iframe>

        <div id="dexLoading" className="dex-loading">
          Loading chart…
        </div>

        <div id="retryBtn" className="dex-retry">
          Retry Loading Chart
        </div>
      </div>
    </div>
  );
}
