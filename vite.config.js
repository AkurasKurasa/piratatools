import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * GitHub Pages has no rewrite rules, so a deep link like /tools/qr-code would 404.
 * Serving the app as 404.html lets the router handle every path.
 */
const spaFallback = () => ({
  name: 'spa-fallback',
  closeBundle() {
    copyFileSync(resolve('dist/index.html'), resolve('dist/404.html'))
  },
})

// https://vite.dev/config/
export default defineConfig({
  // '/' for Vercel and local dev; the GitHub Pages workflow sets BASE_PATH=/piratatools/.
  base: process.env.BASE_PATH || '/',
  plugins: [react(), spaFallback()],
})
