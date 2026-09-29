import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the app from /<repo>/. Set BASE_PATH if the repo name differs.
const base = process.env.BASE_PATH ?? '/'

// Content-Security-Policy for the published app (GitHub Pages can't set headers, so it is a meta tag).
// The app may only load its own files and talk to itself and the Claude API; if a dependency were ever
// compromised it could not send the API key or training data anywhere else. Build only: the dev
// server needs inline scripts and a websocket for hot reload.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://api.anthropic.com",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

const cspPlugin: Plugin = {
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
}

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
  },
  plugins: [
    cspPlugin,
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Training Log',
        short_name: 'Training',
        description: 'Personal training log with an evidence based progression engine',
        theme_color: '#0b0d10',
        background_color: '#0b0d10',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
})
