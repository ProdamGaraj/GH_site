import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Per-environment values come from .env.<mode> (e.g. .env.test, .env.production).
  // ALLOWED_HOSTS is a comma-separated list of hostnames that Vite's host-check
  // (DNS-rebinding protection) must accept. localhost / *.localhost / IPs are
  // always allowed, so the local (development) mode needs no entry. Not
  // VITE_-prefixed: it's server config, not client-exposed, so we read the full
  // env via loadEnv(..., '').
  const env = loadEnv(mode, process.cwd(), '')
  const allowedHosts = (env.ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)

  // Токен записи estate-service инжектится ПРОКСИ (server-side), не браузером —
  // чтобы не светить его в клиенте. Значение из окружения контейнера frontend.
  const estateToken =
    process.env.ESTATE_WRITE_TOKEN || env.ESTATE_WRITE_TOKEN || 'dev-estate-write-token-change-me'

  return {
    // The CMS is served under this path prefix by nginx on the shared domain
    // (<domain>/visual_cms/). `base` must match so every asset URL, the HMR
    // client and the router basename (src/app/routes.tsx) resolve under the
    // prefix. Constant across environments.
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
      allowedHosts,
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
        // Модуль ЖК (estate-service). Прокси добавляет X-Estate-Token к запросам
        // записи (на проде — nginx location /estate-api/ + auth_request к CMS).
        '/estate-api': {
          target: 'http://estate-service:5100',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/estate-api/, ''),
          headers: { 'X-Estate-Token': estateToken },
        },
      },
    },
  }
})
