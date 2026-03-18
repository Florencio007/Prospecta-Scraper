import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import * as path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { exec, spawn } from "child_process";
import * as fs from "fs";
import * as urlModule from "url";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:7842',
        changeOrigin: true,
        secure: false,
      }
    },
    watch: {
      ignored: [
        "**/scripts/**",
        "**/*-results.json",
        "**/last_gmaps_results.json"
      ]
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs', '@radix-ui/react-toast'],
          supabase: ['@supabase/supabase-js'],
          charts: ['recharts'],
          utils: ['clsx', 'tailwind-merge', 'date-fns'],
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        clientsClaim: true,
        skipWaiting: true
      },
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
      manifest: {
        name: "Prospecta",
        short_name: "Prospecta",
        description: "Plateforme de prospection multicanale pour les entreprises malgaches",
        theme_color: "#1a3a52",
        icons: [
          {
            src: "/logo_prospecta_dark.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/logo_prospecta_dark.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/logo_prospecta_dark.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
