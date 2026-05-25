/**
 * Резолв базового URL до бэкенд-`/api`.
 *
 * Дефолт — относительный `/api`. Это работает «из коробки» в трёх режимах:
 *   - Vite dev-proxy (см. vite.config.ts `server.proxy['/api']`) — same-origin.
 *   - https-туннели (VS Code Dev Tunnels / ngrok / Cloudflare Tunnel),
 *     которые форвардят только порт фронта.
 *   - Prod-сборка, раздаваемая nginx, который сам проксирует `/api` в бэк.
 *
 * Зашивать `http://localhost:5000` в бандл нельзя: при доступе с другого
 * хоста (туннель / LAN / port-forward) браузер уйдёт в localhost клиента.
 *
 * Override `VITE_API_URL` — только когда фронт фронтится с другого origin,
 * чем бэк, и same-origin proxy недоступен.
 */
export function getApiBaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_API_URL as string | undefined
  if (!envUrl) return '/api'
  return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`
}
