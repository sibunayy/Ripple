import { defineConfig } from 'vite';
import { serviceWorker } from './pwa/vite-plugin-sw';

// RippleFlow build settings.
// base './' keeps every asset path relative, so the built app works from any folder or GitHub Pages path.
export default defineConfig({
  base: './',
  plugins: [serviceWorker()], // writes sw.js for offline use (phase 6)
  server: { port: 5180, strictPort: false },
  build: {
    target: 'safari16.4', // iPadOS 16.4+ is the primary target
    cssTarget: 'safari16.4',
    outDir: 'dist',
    sourcemap: true,
    cssMinify: false, // keep the CSS text as written, so the cascade is byte-for-byte the prototype's
  },
});
