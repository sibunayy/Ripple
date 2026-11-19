import { defineConfig } from 'vite';

// RippleFlow build settings.
// base './' keeps every asset path relative, so the built app works from any folder or GitHub Pages path.
export default defineConfig({
  base: './',
  server: { port: 5180, strictPort: false },
  build: {
    target: 'safari16.4', // iPadOS 16.4+ is the primary target
    cssTarget: 'safari16.4',
    outDir: 'dist',
    sourcemap: true,
    cssMinify: false, // keep the CSS text as written, so the cascade is byte-for-byte the prototype's
  },
});
