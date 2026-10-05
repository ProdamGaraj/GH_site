import { logger } from './Logger'

/**
 * Отчёт сервису-источнику о деплое коллекции: какие элементы выкачены на
 * каждом языке.
 *
 * Нужен news-service: его публичная лента (бесконечная прокрутка на /news)
 * отдаёт только выкаченные новости — иначе карточка опубликованной, но ещё
 * не выкаченной новости вела бы на 404.
 *
 * Куда слать — не адрес из базы, а ключ известной интеграции
 * (Collection.reportDeployTo): адрес и токен берутся из окружения backend.
 * Так коллекция не может направить запрос куда угодно (SSRF), а секрет не
 * лежит в базе. Отчёт — best-effort: сбой становится предупреждением деплоя,
 * а не ошибкой — страницы уже на сайте.
 */
export const DEPLOY_REPORT_TARGETS = ['news-service'] as const
export type DeployReportTarget = (typeof DEPLOY_REPORT_TARGETS)[number]

interface ReportEndpoint {
  url: string
  headers: Record<string, string>
}

function endpointFor(target: DeployReportTarget): ReportEndpoint | null {
  if (target === 'news-service') {
    const base = process.env.NEWS_SERVICE_URL
    const token = process.env.NEWS_WRITE_TOKEN
    if (!base || !token) return null
    return { url: `${base.replace(/\/+$/, '')}/api/admin/deployed`, headers: { 'X-News-Token': token } }
  }
  return null
}

export function isDeployReportTarget(value: unknown): value is DeployReportTarget {
  return typeof value === 'string' && (DEPLOY_REPORT_TARGETS as readonly string[]).includes(value)
}

/**
 * Шлёт отчёт по каждому языку: { locale, slugs }. Возвращает предупреждения
 * (пусто — всё дошло).
 */
export async function reportCollectionDeploy(
  target: DeployReportTarget,
  deployedByLang: ReadonlyMap<string, readonly string[]>,
  fetchImpl: typeof fetch = fetch
): Promise<string[]> {
  const endpoint = endpointFor(target)
  if (!endpoint) {
    return [`Отчёт о деплое (${target}) не отправлен: не заданы адрес или токен сервиса в окружении backend`]
  }
  const warnings: string[] = []
  for (const [locale, slugs] of deployedByLang) {
    try {
      const res = await fetchImpl(endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...endpoint.headers },
        body: JSON.stringify({ locale, slugs }),
      })
      if (!res.ok) warnings.push(`Отчёт о деплое (${target}, ${locale}): HTTP ${res.status}`)
    } catch (err: any) {
      warnings.push(`Отчёт о деплое (${target}, ${locale}): ${err?.message ?? err}`)
      logger.warn('[deployReport] failed', { target, locale, error: err?.message })
    }
  }
  return warnings
}
