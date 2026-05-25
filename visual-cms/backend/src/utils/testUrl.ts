/**
 * Разрешение тестового URL для проверки подключения Data Source.
 *
 * Базовый URL источника (config.url) — это база/префикс (например
 * `https://api.example.com/v2`). Пользователь задаёт «Тестировать по методу»
 * (config.testEndpoint), и тест бьёт по нему:
 *  - пусто → базовый URL (как раньше);
 *  - абсолютный (http/https) → используется как есть;
 *  - относительный (`tools/list`, `/health`) → ДОБАВЛЯЕТСЯ к базовому URL.
 *
 * Используется именно добавление, а не `new URL(path, base)`: стандартная
 * семантика отбрасывает последний сегмент пути базы без хвостового `/`
 * (`new URL('tools/list', '…/v2')` → `…/tools/list`, теряя `/v2`), что
 * контринтуитивно для модели «Base URL + endpoint».
 *
 * Чистая функция (без сети/БД) — покрыта unit-тестами.
 */
export function resolveTestUrl(baseUrl: string, testEndpoint?: string): string {
  const ep = testEndpoint?.trim()
  if (!ep) return baseUrl
  if (/^https?:\/\//i.test(ep)) return ep
  return `${baseUrl.replace(/\/+$/, '')}/${ep.replace(/^\/+/, '')}`
}
