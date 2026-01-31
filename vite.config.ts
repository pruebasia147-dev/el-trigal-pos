
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Panadería El Trigal POS',
        short_name: 'El Trigal',
        description: 'Punto de Venta PWA para gestión de mostrador y despacho de rutas.',
        theme_color: '#ca8a04',
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/992/992747.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://cdn-icons-png.flaticon.com/512/992/992747.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ],
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait"
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'product-images',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 Days
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    outDir: 'dist',
  }
});
