import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@content": resolve(root, "content"), "@assets": resolve(root, "assets") },
  },
  server: {
    port: 5173,
    fs: { allow: [root] },
    proxy: { "/api": { target: "http://127.0.0.1:8787", ws: true } },
  },
  build: {
    target: ["es2020", "safari14"],
    chunkSizeWarningLimit: 900,
  },
});
