import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/airchat/',
  plugins: [
    react(),
    VitePWA({
      // injectManifest lets us use our own sw.js (src/sw.js)
      // VitePWA compiles it + injects the precache manifest automatically
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',

      registerType: 'autoUpdate',

      // These get precached by Workbox (offline app shell)
      includeAssets: [
        'favicon.svg',
        'favicon-96x96.png',
        'robots.txt',
        'llm.txt',
        'web-app-manifest-192x192.png',
        'web-app-manifest-512x512.png',
      ],

      manifest: {
        name: 'AirChat',
        short_name: 'AirChat',
        description: 'P2P Serverless chat app with dark and light themes',
        theme_color: '#25d366',
        background_color: '#25d366',
        display: 'standalone',
        start_url: '/airchat/',
        scope: '/airchat/',
        orientation: 'portrait-primary',
        lang: 'en-US',
        categories: ['communication', 'social'],
        icons: [
          {
            src: '/airchat/web-app-manifest-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/airchat/web-app-manifest-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },

      // Workbox config — what to precache
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
});
