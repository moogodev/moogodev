import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type ProxyOptions } from "vite";

// The Go backend the dev server proxies API calls to. It is read from the
// environment so a different port can be used without editing this file.
const apiTarget = process.env.MOOO_API_TARGET ?? "http://localhost:8080";

// The API paths the SPA calls. In production these are served by the same Go
// binary; in development Vite forwards them to the backend so the browser can
// keep making same-origin requests (which is what makes the session cookie and
// credentials work without any CORS setup).
const apiPaths = ["/api", "/auth", "/db", "/bucket"];

// Build output goes to web/dist, which Go embeds into the binary.
//
// The base differs between the two modes on purpose:
//
//   - build uses /static/ because the Go server serves the whole dist tree
//     under that prefix while answering the page routes (/, /login, /app,
//     /docs) with index.html. So a built page at /register loads its assets
//     from /static/assets/...
//   - dev uses / so the page URLs match production (http://localhost:5173/
//     register, not .../static/register). Vite serves the assets itself in
//     dev, so no /static/ prefix is needed.
//
// Assets are never inlined: the server sends a strict CSP without 'unsafe-
// inline' or data:, so a base64 asset or an inline module would be blocked in
// the browser.
export default defineConfig(({ command }) => {
  // The same proxy is used by `vite dev` and `vite preview`. Preview serves
  // the built files without it, so /auth and /api would 404 there and the sign
  // -in form could never reach the backend.
  //
  // The backend refuses a state-changing request whose Origin names a
  // different host than the one it was addressed as. The browser legitimately
  // sends this dev server's origin on every POST, so the proxy rewrites the
  // header to the forwarding target: from the backend's point of view the
  // request is same-origin, which is exactly what the proxy makes it.
  const proxy = Object.fromEntries(
    apiPaths.map(
      (path): [string, ProxyOptions] => [
        path,
        {
          target: apiTarget,
          changeOrigin: true,
          configure(proxy) {
            proxy.on("proxyReq", (request) => {
              request.setHeader("Origin", apiTarget);
            });
          },
        },
      ],
    ),
  );

  return {
  plugins: [react(), tailwindcss()],
  base: command === "build" ? "/static/" : "/",
  server: { proxy },
  preview: { proxy },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  };
});
