import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import basicSsl from "@vitejs/plugin-basic-ssl";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: true, // Listen on all network interfaces
    https: true, // Enable HTTPS
  },
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(), // Automatically generate a local self-signed certificate
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icon-192.svg", "icon-512.svg"],
      manifest: {
        name: "Signal Zone",
        short_name: "SignalZone",
        description: "Real-time network quality visualizer",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        icons: [
          {
            src: "icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },
          {
            src: "icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
          },
          {
            src: "icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
