import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "vite";

// Adds data-cfasync="false" to all <script> tags in the built HTML so that
// Cloudflare Rocket Loader does not defer/wrap ES module execution.
// The Go server also sets Cache-Control: no-transform on HTML responses as
// a belt-and-suspenders measure.
function cfAsyncDisable(): Plugin {
  return {
    name: "cf-async-disable",
    transformIndexHtml(html) {
      return html.replace(/<script /g, '<script data-cfasync="false" ');
    },
  };
}

export default defineConfig({
  plugins: [solidPlugin(), tailwindcss(), cfAsyncDisable()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "esnext",
    outDir: "dist",
  },
});
