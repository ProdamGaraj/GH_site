/**
 * Запросы к MacroCRM в обход проверки TLS-сертификата.
 *
 * ЗАЧЕМ ЭТО СУЩЕСТВУЕТ. Сертификат api.macrocrm.gh.uz истёк 25.09.2025, и без
 * обхода синхронизация не соединяется вовсе. Это заплатка на время, пока
 * сертификат не продлят; настоящее решение — продлить его на сервере CRM.
 *
 * ПОЧЕМУ НЕ NODE_TLS_REJECT_UNAUTHORIZED. Эта переменная выключает проверку
 * во всём процессе. Бэкенд CMS ходит не только в Macro, и глобальное отключение
 * сняло бы защиту и с остальных соединений — включая те, о которых сейчас никто
 * не думает. Здесь отключение живёт ровно в одном клиенте.
 *
 * Модуль повторяет только ту часть интерфейса fetch, которой пользуется
 * MacroHttp: status, ok, text(), json(). Полноценной заменой fetch он не
 * является и не должен ею стать.
 */

import * as http from 'http'
import * as https from 'https'
import { URL } from 'url'

/** Минимальный ответ в форме, которую ждёт MacroHttp. */
type MinimalResponse = Pick<Response, 'status' | 'ok' | 'text' | 'json'>

/**
 * fetch, не проверяющий сертификат.
 *
 * Протокол выбирается по адресу: для http модуль https не годится, а тесты
 * гоняют ровно этот код на обычном http-сервере — иначе проверять было бы
 * нечего, кроме самого факта существования функции.
 */
export const insecureFetch: typeof fetch = (input, init = {}) => {
  // MacroHttp всегда зовёт с готовым URL-строкой; Request как вход не
  // поддерживаем — подменять весь fetch этот модуль не должен.
  if (typeof input !== 'string' && !(input instanceof URL)) {
    return Promise.reject(new Error('macroInsecureFetch: поддерживается только URL строкой'))
  }
  const target = typeof input === 'string' ? new URL(input) : input
  const transport = target.protocol === 'http:' ? http : https

  return new Promise((resolve, reject) => {
    const body = typeof init.body === 'string' ? init.body : undefined

    const request = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === 'http:' ? 80 : 443),
        path: target.pathname + target.search,
        method: init.method ?? 'GET',
        headers: {
          ...(init.headers as Record<string, string> | undefined),
          ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        },
        // Собственно то, ради чего модуль и написан.
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          const status = res.statusCode ?? 0
          const minimal: MinimalResponse = {
            status,
            ok: status >= 200 && status < 300,
            text: async () => text,
            json: async () => JSON.parse(text),
          }
          resolve(minimal as Response)
        })
      }
    )

    // Обрыв соединения приходит событием, а не исключением: без обработчика
    // промис завис бы навсегда, и синк встал бы молча.
    request.on('error', reject)

    // AbortController у fetch отменяет запрос — здесь то же самое вручную.
    const signal = init.signal
    if (signal) {
      if (signal.aborted) request.destroy(new Error('aborted'))
      else signal.addEventListener('abort', () => request.destroy(new Error('aborted')))
    }

    if (body) request.write(body)
    request.end()
  })
}
