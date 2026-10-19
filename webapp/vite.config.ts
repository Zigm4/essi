/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages project site serves from /<repo>/ — override at build time with
// VITE_BASE (the deploy workflow sets it; local dev stays at /).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    react(),
    VitePWA({
      // 'prompt': a new version waits until the user taps "Reload" (see
      // src/app/registerServiceWorker.ts) instead of swapping under an open editor.
      registerType: 'prompt',
      // Fonts are imported from src (hashed assets, base-path safe); only the
      // OFL license texts and the favicon live in public.
      includeAssets: ['fonts/*.txt', 'favicon.svg'],
      manifest: {
        name: 'ESSI',
        short_name: 'ESSI',
        description:
          'ESSI — a pocket terminal for pilots. Unofficial fan companion for Underpunks55.',
        theme_color: '#03060B',
        background_color: '#03060B',
        display: 'standalone',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // The data ships with the code: catalogs (json), the knowledge base
        // (md + manifest) and the map seed are precached so every tool works
        // offline, and code and data always update together.
        globPatterns: ['**/*.{js,css,html,ttf,svg,png,json,md}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
