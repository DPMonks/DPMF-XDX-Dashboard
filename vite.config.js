import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: ".",            // ensure Vite looks in the project root
  plugins: [react()],
  build: {
    outDir: "dist",     // Vercel expects this
  },
});
