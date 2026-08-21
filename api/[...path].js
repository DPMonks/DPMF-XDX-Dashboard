import {
  fetchIndexerFirst,
  handshakePostBody,
  indexerPathsFor,
  proxyCorsHeaders,
} from "../server/proxyIndexer.js";

export const maxDuration = 10;

export default async function handler(req, res) {
  const parts = req.query.path;
  const suffix = Array.isArray(parts) ? parts.join("/") : parts || "";

  for (const [key, value] of Object.entries(proxyCorsHeaders())) {
    res.setHeader(key, value);
  }

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (suffix.startsWith("xaman")) {
    res.status(404).json({ error: "Xaman stays on dashboard /api/xaman/*" });
    return;
  }

  const search = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const isHandshake = /handshake$/i.test(suffix);
  const method = isHandshake && req.method === "HEAD" ? "GET" : req.method;
  const body =
    method === "POST" || method === "PUT"
      ? handshakePostBody(req.body)
      : undefined;

  try {
    const last = await fetchIndexerFirst(indexerPathsFor(suffix), {
      method,
      body,
      search,
    });
    res.status(last?.status || 502);
    res.setHeader("content-type", last?.contentType || "application/json");
    res.setHeader("cache-control", "s-maxage=30, stale-while-revalidate=120");
    res.send(last?.body || JSON.stringify({ error: "Indexer proxy failed" }));
  } catch (error) {
    res.status(502).json({ error: error.message || "Indexer proxy failed" });
  }
}
