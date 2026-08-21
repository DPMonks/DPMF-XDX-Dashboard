import { fetchIndexer, joinIndexerUrl, indexerOrigin } from "../server/proxyIndexer.js";

export default async function handler(req, res) {
  const parts = req.query.path;
  const suffix = Array.isArray(parts) ? parts.join("/") : parts || "";

  if (suffix.startsWith("xaman")) {
    res.status(404).json({ error: "Xaman stays on dashboard /api/xaman/*" });
    return;
  }

  const search = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const origin = indexerOrigin();
  const paths = [`/api/${suffix}`];
  if (suffix === "handshake" || suffix === "cluster/v1/handshake") {
    paths.push("/handshake", "/cluster/v1/handshake", "/api/v1/handshake");
  }

  try {
    let last;
    for (const path of paths) {
      last = await fetchIndexer(joinIndexerUrl(origin, path, search), {
        method: req.method,
      });
      if (last.status < 500 && last.status !== 404) {
        res.status(last.status);
        res.setHeader("content-type", last.contentType);
        res.setHeader("cache-control", "s-maxage=15, stale-while-revalidate=45");
        res.send(last.body);
        return;
      }
    }
    res.status(last?.status || 502);
    res.setHeader("content-type", last?.contentType || "application/json");
    res.send(last?.body || JSON.stringify({ error: "Indexer proxy failed" }));
  } catch (error) {
    res.status(502).json({ error: error.message || "Indexer proxy failed" });
  }
}
