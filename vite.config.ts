import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the repo under /<repo>/. Override with BASE=/ for root hosting.
const base = process.env.BASE ?? '/Ripple/';

export default defineConfig({
  base,
  build: { target: 'es2022', sourcemap: false },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt', // never reload mid-edit; the UI shows an update toast
      includeAssets: ['apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'Ripple',
        short_name: 'Ripple',
        description: 'Lightweight motion graphics for iPad',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#0e0f12',
        theme_color: '#0e0f12',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], navigateFallback: 'index.html' },
    }),
  ],
  test: { include: ['tests/**/*.test.ts'] },
});
