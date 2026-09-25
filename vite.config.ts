import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [VitePWA({
    registerType: "prompt",
    injectRegister: "script",
    manifest: { name: "NER LENS Control", short_name: "Control", description: "Delivery and corridor control", theme_color: "#f7f7f5", background_color: "#f7f7f5", display: "standalone", start_url: "/control/", icons: [{ src: "/control-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }] },
    workbox: { navigateFallbackDenylist: [/^\/v1(?:\/|$)/, /^\/health(?:\/|$)/], globPatterns: ["**/*.{js,css,html,svg,webmanifest}"], maximumFileSizeToCacheInBytes: 5000000, runtimeCaching: [] },
  })],
  server: {
    proxy: {
      "/v1": { target: "http://127.0.0.1:8000", changeOrigin: false },
      "/health": { target: "http://127.0.0.1:8000", changeOrigin: false },
    },
  },
});
