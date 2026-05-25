import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: path.resolve(__dirname, "frontend"),
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared")
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000"
    },
    fs: {
      allow: [path.resolve(__dirname)]
    }
  },
  build: {
    outDir: path.resolve(__dirname, "dist/client"),
    emptyOutDir: true
  }
});
