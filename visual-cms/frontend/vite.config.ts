import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    // Hosts allowed past Vite's host-check (DNS-rebinding protection).
    // localhost / *.localhost / IPs are always allowed; real domains are not,
    // so the CMS subdomain served via nginx must be listed explicitly.
    allowedHosts: ['cms.test_analytics.gh.uz'],
    watch: {
      usePolling: true,
    },
    hmr: {
      overlay: true,
    },
    proxy: {
      '/api': {
        target: 'http://backend:5000',
        changeOrigin: true,
      },
      '/media/': {
        target: 'http://minio:9000/cms-media',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/media/, ''),
      },
    },
  },
})
