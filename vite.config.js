import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import {
  fetchIndexerFirst,
  handshakePostBody,
  indexerOrigin,
  indexerPathsFor,
} from "./server/proxyIndexer.js";

function xamanDevPlugin(env) {
  const headers = () => {
    const key = env.XUMM_API_KEY || env.VITE_XUMM_API_KEY;
    const secret = env.XUMM_API_SECRET || env.VITE_XUMM_API_SECRET;
    if (!key || !secret) {
      throw new Error("XUMM_API_KEY and XUMM_API_SECRET are not configured");
    }
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-API-Key": key,
      "X-API-Secret": secret,
    };
  };

  return {
    name: "xaman-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (req.url?.startsWith("/api/xaman/create-payload") && req.method === "POST") {
            const response = await fetch("https://xumm.app/api/v1/platform/payload", {
              method: "POST",
              headers: headers(),
              body: JSON.stringify({ txjson: { TransactionType: "SignIn" } }),
            });
            const text = await response.text();
            res.statusCode = response.status;
            res.setHeader("Content-Type", "application/json");
            res.end(text);
            return;
          }

          if (req.url?.startsWith("/api/xaman/payload-result") && req.method === "GET") {
            const uuid = new URL(req.url, "http://localhost").searchParams.get("uuid");
            const response = await fetch(
              `https://xumm.app/api/v1/platform/payload/${encodeURIComponent(uuid || "")}`,
              { headers: headers() }
            );
            const text = await response.text();
            res.statusCode = response.status;
            res.setHeader("Content-Type", "application/json");
            res.end(text);
            return;
          }
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: error.message }));
          return;
        }
        next();
      });
    },
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      if (!chunks.length) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function indexerDevProxy() {
  return {
    name: "indexer-dev-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";
        const pathOnly = url.split("?")[0];
        if (pathOnly.startsWith("/api/xaman")) {
          next();
          return;
        }

        let suffix = null;
        if (pathOnly === "/handshake") suffix = "handshake";
        else if (pathOnly.startsWith("/cluster/")) suffix = pathOnly.slice(1);
        else if (pathOnly === "/health") suffix = "health";
        else if (pathOnly === "/api" || pathOnly === "/api/") suffix = "";
        else if (pathOnly.startsWith("/api/")) suffix = pathOnly.slice(5);

        if (suffix == null) {
          next();
          return;
        }

        try {
          const search = url.includes("?") ? url.slice(url.indexOf("?")) : "";
          const method = req.method || "GET";
          const body =
            method === "POST" || method === "PUT"
              ? handshakePostBody(await readJsonBody(req))
              : undefined;
          const last = await fetchIndexerFirst(indexerPathsFor(suffix), {
            method,
            body,
            search,
          });
          res.statusCode = last?.status || 502;
          res.setHeader("content-type", last?.contentType || "application/json");
          res.end(last?.body || JSON.stringify({ error: "Indexer proxy failed" }));
        } catch (error) {
          res.statusCode = 502;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);
  indexerOrigin(env);
  return {
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    plugins: [react(), xamanDevPlugin(env), indexerDevProxy()],
    server: {
      host: true,
      port: 5173,
    },
  };
});
