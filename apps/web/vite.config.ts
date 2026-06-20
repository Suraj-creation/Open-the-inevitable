import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The browser folds the live surface.* stream with the SAME pure function the runtime uses.
// Alias the browser-safe `./client` entry to its source so Vite transforms it (zero Node deps;
// the only runtime module pulled is the import-free projection fold).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@inevitable/surface/client": fileURLToPath(
        new URL("../../packages/surface/src/client.ts", import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    // The runtime is the product; the gateway is the boundary. Dev proxies commands + stream to it.
    proxy: { "/api": "http://localhost:8787" },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
