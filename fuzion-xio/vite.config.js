import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");
  const apiOrigin = env.VITE_API_ORIGIN || "http://127.0.0.1:8080";

  return {
    plugins: [
      react({ include: "**/*.{js,jsx}" }),
      nodePolyfills({
        include: ["buffer", "process", "stream", "util", "events"],
        globals: { Buffer: true, global: true, process: true }
      })
    ],
    resolve: {
      alias: {
        src: path.resolve(root, "src")
      }
    },
    esbuild: {
      loader: "jsx",
      include: /src\/.*\.jsx?$/,
      exclude: []
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          ".js": "jsx"
        }
      }
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode === "production" ? "production" : "development"),
      "process.env.REACT_APP_INFURA_IPFS_PROJECT_ID": JSON.stringify(
        env.VITE_INFURA_IPFS_PROJECT_ID || env.REACT_APP_INFURA_IPFS_PROJECT_ID || ""
      ),
      "process.env.REACT_APP_INFURA_IPFS_PROJECT_SECRET": JSON.stringify(
        env.VITE_INFURA_IPFS_PROJECT_SECRET || env.REACT_APP_INFURA_IPFS_PROJECT_SECRET || ""
      )
    },
    server: {
      host: true,
      port: 5174,
      proxy: {
        "/api": { target: apiOrigin, changeOrigin: true, secure: true },
        "/convert-fbx": { target: apiOrigin, changeOrigin: true, secure: true },
        "/proxy-ipfs": { target: apiOrigin, changeOrigin: true, secure: true }
      }
    },
    preview: {
      host: true,
      port: 4174
    }
  };
});
