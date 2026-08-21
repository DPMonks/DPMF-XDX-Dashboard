import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    plugins: [react(), xamanDevPlugin(env)],
    server: {
      host: true,
      port: 5173,
    },
  };
});
