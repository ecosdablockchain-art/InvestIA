import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        importScripts: ['push-sw.js'],
      },
      includeAssets: ['icone.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Finanças 360',
        short_name: 'Finanças 360',
        description: 'Suas finanças pessoais, privadas e offline.',
        lang: 'pt-BR',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b1220',
        theme_color: '#0b1220',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  define: {
    __VERSAO__: JSON.stringify(`${process.env.npm_package_version ?? '0.1.0'} · ${(process.env.GITHUB_SHA ?? 'local').slice(0, 7)} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`),
  },
  test: {
    environment: 'node',
  },
})
