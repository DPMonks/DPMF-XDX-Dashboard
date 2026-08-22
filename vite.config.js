import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { attachIndexerProxy } from "./server/attachProxy.js";
import { indexerOrigin } from "./server/proxyIndexer.js";
import {
  buildXamanPayload,
  readJson,
  requestOrigin,
  xamanErrorMessage,
  xummHeaders,
} from "./api/xaman/_xumm.js";

function xamanDevPlugin() {
  const middleware = async (req, res, next) => {
    try {
      const origin = requestOrigin(req);
      if (req.url?.startsWith("/api/xaman/create-payload") && req.method === "POST") {
        const body = await readJson(req);
        const response = await fetch("https://xumm.app/api/v1/platform/payload", {
          method: "POST",
          headers: xummHeaders(origin),
          body: JSON.stringify(buildXamanPayload(origin, body.txjson, body.options)),
        });
        const data = await response.json().catch(() => ({}));
        res.statusCode = response.status;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify(
            response.ok ? data : { error: xamanErrorMessage(data), code: data?.error?.code }
          )
        );
        return;
      }

      if (req.url?.startsWith("/api/xaman/payload-result") && req.method === "GET") {
        const uuid = new URL(req.url, "http://localhost").searchParams.get("uuid");
        const response = await fetch(
          `https://xumm.app/api/v1/platform/payload/${encodeURIComponent(uuid || "")}`,
          { headers: xummHeaders(origin) }
        );
        const data = await response.json().catch(() => ({}));
        res.statusCode = response.status;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify(
            response.ok
              ? data
              : { error: xamanErrorMessage(data, "Failed to read Xaman payload") }
          )
        );
        return;
      }
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: error.message }));
      return;
    }
    next();
  };

  return {
    name: "xaman-dev",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

function indexerDevProxy() {
  return {
    name: "indexer-dev-proxy",
    configureServer(server) {
      attachIndexerProxy(server);
    },
    configurePreviewServer(server) {
      attachIndexerProxy(server);
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
    preview: {
      host: true,
      port: 4173,
    },
  };
});
