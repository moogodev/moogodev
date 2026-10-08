import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The Go backend the dev server proxies API calls to. In production the same
// origin serves /api, so the proxy only exists to keep same-origin requests
// (and the session cookie) working under `vite dev`.
const apiTarget = process.env.NEWS_API_TARGET ?? "http://127.0.0.1:8081";

const proxy = {
  "/api": { target: apiTarget, changeOrigin: true },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy },
  preview: { proxy },
  build: {
    outDir: "dist",
    // No inline assets: the Go server sends a CSP without 'unsafe-inline'
    // or data:, so a base64 module or script would be blocked in the browser.
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
  },
});
