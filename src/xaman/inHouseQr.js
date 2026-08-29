import QRCode from "qrcode";
import { xamanAppUrl } from "./xamanClient.js";

export function xamanSignQrHref(uuid) {
  return xamanAppUrl(uuid);
}

export function xamanAppQrSvg(uuid) {
  const href = xamanSignQrHref(uuid);
  if (!href) return "";
  const qr = QRCode.create(href, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cells = [];
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if (qr.modules.get(y, x)) {
        cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" fill="#000">${cells.join("")}</svg>`;
}

export function xamanAppQrDataUrl(uuid) {
  const svg = xamanAppQrSvg(uuid);
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : "";
}
