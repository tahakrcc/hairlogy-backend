import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        injectionPoint: undefined
      },
      includeAssets: ['**/*'],
      manifest: {
        name: 'Hairlogy',
        short_name: 'Hairlogy',
        description: 'Hairlogy Randevu Sistemi',
        theme_color: '#121212',
        background_color: '#121212',
        display: 'standalone',
        start_url: '/randevu',
        icons: [
          {
            src: '/Gemini_Generated_Image_ii78ufii78ufii78.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  optimizeDeps: {
    include: ['html2canvas', 'jspdf'],
    force: true
  },
  publicDir: 'public',
  build: {
    chunkSizeWarningLimit: 1600
  }
})
