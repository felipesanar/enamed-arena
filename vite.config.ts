import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    headers: {
      // Security headers — also configure at the hosting level for production (Supabase/Netlify/Vercel)
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
      "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-* required for Vite HMR in dev
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
        "frame-ancestors 'none'",
      ].join("; "),
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core — changes rarely, long cache
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "vendor-react";
          }
          // Router
          if (id.includes("node_modules/react-router")) {
            return "vendor-router";
          }
          // Framer Motion — large, changes independently of app code
          if (id.includes("node_modules/framer-motion")) {
            return "vendor-motion";
          }
          // Recharts + D3 — only used on ComparativoPage (lazy)
          if (
            id.includes("node_modules/recharts") ||
            id.includes("node_modules/d3-") ||
            id.includes("node_modules/victory-")
          ) {
            return "vendor-charts";
          }
          // Supabase
          if (id.includes("node_modules/@supabase")) {
            return "vendor-supabase";
          }
          // Radix UI primitives — large collection of UI components
          if (id.includes("node_modules/@radix-ui")) {
            return "vendor-radix";
          }
          // TanStack Query
          if (id.includes("node_modules/@tanstack")) {
            return "vendor-query";
          }
          // Admin-specific heavy deps (xlsx, jszip) — only loaded when admin route is visited
          if (
            id.includes("node_modules/xlsx") ||
            id.includes("node_modules/jszip")
          ) {
            return "vendor-admin-heavy";
          }
          // All other node_modules go to vendor-misc
          if (id.includes("node_modules/")) {
            return "vendor-misc";
          }
        },
      },
    },
  },
}));
