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
      registerType: 'autoUpdate',
      workbox: {
        // OCR é grande: fica fora da instalação e entra no cache no primeiro uso
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,webmanifest}'],
        globIgnores: ['**/ocr/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.includes('/ocr/'),
          handler: 'CacheFirst',
          options: { cacheName: 'ocr', expiration: { maxEntries: 10 } },
        }],
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
    __VERSAO__: JSON.stringify(process.env.npm_package_version ?? '0.1.0'),
  },
  test: {
    environment: 'node',
  },
})
