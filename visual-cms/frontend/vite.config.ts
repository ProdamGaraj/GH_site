import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  // The CMS is served under this path prefix by nginx on the shared domain
  // (test_analytics.gh.uz/visual_cms/). `base` must match so every asset URL
  // and the HMR client resolve under the prefix. Locally the dev server is then
  // reachable at http://localhost:3000/visual_cms/ (not bare /). The router
  // basename is derived from this value (see src/app/routes.tsx).
  base: '/visual_cms/',
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
    // localhost / *.localhost / IPs are always allowed; the real domain that
    // nginx forwards must be listed explicitly.
    allowedHosts: ['test_analytics.gh.uz'],
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
