/**
 * SSRF guard.
 *
 * Перед любым исходящим запросом к пользовательскому URL (Data Source)
 * проверяем, что хост не указывает на loopback/private/link-local/metadata.
 * Защита от SSRF: создатель Data Source не должен иметь возможность заставить
 * backend ходить во внутреннюю сеть или в облачную metadata-службу.
 *
 * Это defense-in-depth, а не песочница: эвристика по IPv6 покрывает типовые
 * векторы (::1, ULA, link-local, IPv4-mapped), но не все экзотические формы.
 *
 * Доверенные внутренние хосты можно явно разрешить через переменную окружения
 * SSRF_ALLOWED_HOSTS (через запятую, точное совпадение hostname, lowercase).
 */

import dns from 'dns'
import net from 'net'

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SsrfBlockedError'
  }
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])
const MAX_REDIRECTS = 5

function allowedHosts(): Set<string> {
  return new Set(
    (process.env.SSRF_ALLOWED_HOSTS || '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
  )
}

/**
 * Заблокирован ли IPv4-адрес (приватный/loopback/link-local/reserved).
 */
function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p))
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    // Не валидный IPv4 — блокируем (fail closed)
    return true
  }
  const [a, b] = parts

  if (a === 0) return true // 0.0.0.0/8
  if (a === 10) return true // 10.0.0.0/8 private
  if (a === 127) return true // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local (incl. cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true // 192.168.0.0/16 private
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 CGNAT
  if (a === 192 && b === 0 && parts[2] === 0) return true // 192.0.0.0/24 IETF
  if (a === 198 && (b === 18 || b === 19)) return true // 198.18.0.0/15 benchmark
  if (a >= 224) return true // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved + 255.255.255.255

  return false
}

/**
 * Заблокирован ли IP (v4 или v6). Чистая функция — тестируется без сети.
 */
export function isBlockedIp(ipRaw: string): boolean {
  const ip = ipRaw.trim().toLowerCase()
  const family = net.isIP(ip)

  if (family === 4) {
    return isBlockedIpv4(ip)
  }

  if (family === 6) {
    if (ip === '::1' || ip === '::') return true // loopback / unspecified
    // IPv4-mapped ::ffff:a.b.c.d или ::ffff:hhhh:hhhh
    const mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
    if (mapped) return isBlockedIpv4(mapped[1])
    if (ip.startsWith('::ffff:')) return true // иные mapped-формы — fail closed
    // fc00::/7 unique-local (fc.. / fd..)
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true
    // fe80::/10 link-local (fe8 / fe9 / fea / feb)
    if (/^fe[89ab]/.test(ip)) return true
    return false
  }

  // Не распознан как IP — сюда не должны попадать (адрес из dns.lookup)
  return true
}

/**
 * Проверяет, что URL допустим для исходящего запроса.
 * Бросает SsrfBlockedError при нарушении.
 */
export async function assertUrlAllowed(rawUrl: string): Promise<void> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new SsrfBlockedError(`Некорректный URL: ${rawUrl}`)
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new SsrfBlockedError(`Протокол не разрешён: ${url.protocol}`)
  }

  const host = url.hostname.toLowerCase()

  if (allowedHosts().has(host)) {
    return // явно доверенный внутренний хост
  }

  // Если host — литеральный IP, проверяем напрямую (без DNS)
  if (net.isIP(host)) {
    if (isBlockedIp(host)) {
      throw new SsrfBlockedError(`Адрес заблокирован (private/loopback/metadata): ${host}`)
    }
    return
  }

  // Иначе резолвим все адреса хоста и проверяем каждый (fail closed)
  let addresses: dns.LookupAddress[]
  try {
    addresses = await dns.promises.lookup(host, { all: true, verbatim: true })
  } catch {
    throw new SsrfBlockedError(`Не удалось разрешить хост: ${host}`)
  }

  if (addresses.length === 0) {
    throw new SsrfBlockedError(`Хост не разрешается: ${host}`)
  }

  for (const { address } of addresses) {
    if (isBlockedIp(address)) {
      throw new SsrfBlockedError(
        `Хост ${host} разрешается в заблокированный адрес ${address} (SSRF)`
      )
    }
  }
}

/**
 * fetch с защитой от SSRF и поэтапной ре-валидацией редиректов.
 *
 * Каждый hop валидируется отдельно: даже если первый URL публичный,
 * редирект на приватный адрес будет отклонён.
 */
export async function safeFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  let currentUrl = rawUrl
  let currentInit: RequestInit = { ...init, redirect: 'manual' }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertUrlAllowed(currentUrl)

    const response = await fetch(currentUrl, currentInit)

    // Не редирект — возвращаем как есть
    if (response.status < 300 || response.status >= 400) {
      return response
    }

    const location = response.headers.get('location')
    if (!location) {
      return response
    }

    if (hop === MAX_REDIRECTS) {
      throw new SsrfBlockedError(`Превышен лимит редиректов (${MAX_REDIRECTS})`)
    }

    // Резолвим относительный Location относительно текущего URL
    currentUrl = new URL(location, currentUrl).toString()

    // 303 (и исторически 301/302) → GET без тела; 307/308 → сохраняем метод/тело
    if (response.status === 303 || response.status === 301 || response.status === 302) {
      currentInit = {
        ...currentInit,
        method: 'GET',
        body: undefined,
        redirect: 'manual',
      }
    }
  }

  // Недостижимо: цикл либо возвращает, либо бросает
  throw new SsrfBlockedError('Ошибка обработки редиректов')
}
