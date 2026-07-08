import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// lovable-tagger is a Lovable-platform-only devDep. Resolve it lazily so a
// dev environment without it (e.g. fresh `npm ci --omit=optional`) still
// builds — instead of failing at config-load time.
function tryLoadComponentTagger(): unknown {
  try {
    return require("lovable-tagger").componentTagger;
  } catch {
    return null;
  }
}

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
  plugins: (() => {
    const list: unknown[] = [react(), mcpPlugin()];
    if (mode === "development") {
      const tagger = tryLoadComponentTagger();
      if (typeof tagger === "function") list.push((tagger as () => unknown)());
    }
    return list.filter(Boolean) as never[];
  })(),
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
          if (!id.includes("node_modules")) return undefined;
          // Keep heavy, rarely-used libs out of the main bundle.
          if (id.includes("jspdf") || id.includes("exceljs") || id.includes("jszip")) {
            return "vendor-pdf-xlsx";
          }
          if (id.includes("framer-motion")) return "vendor-framer";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("lucide-react")) return "vendor-lucide";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("react-router-dom")) return "vendor-router";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "vendor-react";
          }
          return undefined;
        },
      },
    },
  },
}));
