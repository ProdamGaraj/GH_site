/**
 * Транспорт в обход проверки сертификата.
 *
 * Модуль существует из-за истёкшего 25.09.2025 сертификата api.macrocrm.gh.uz.
 * Проверяется здесь не сам обход — его на локальном сервере не воспроизвести
 * без самоподписанного сертификата, — а то, что транспорт ведёт себя как
 * fetch на той части интерфейса, которой пользуется MacroHttp, и что режим
 * включается только по явному флагу.
 */
import * as http from 'http'
import { AddressInfo } from 'net'
import { insecureFetch } from '../services/macroInsecureFetch'
import { MacroHttp } from '../services/MacroHttp'

interface Received {
  method: string
  url: string
  headers: http.IncomingHttpHeaders
  body: string
}

/** Локальный сервер: транспорт выбирает http/https по адресу, код один и тот же. */
function startServer(
  handler: (received: Received) => { status?: number; body: string }
): Promise<{ url: string; close: () => Promise<void>; received: Received[] }> {
  const received: Received[] = []
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const entry: Received = {
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }
      received.push(entry)
      const out = handler(entry)
      res.writeHead(out.status ?? 200, { 'Content-Type': 'application/json' })
      res.end(out.body)
    })
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port
      resolve({
        url: `http://127.0.0.1:${port}`,
        received,
        close: () => new Promise((done) => server.close(() => done())),
      })
    })
  })
}

describe('транспорт', () => {
  it('шлёт метод, путь, заголовки и тело', async () => {
    const server = await startServer(() => ({ body: JSON.stringify({ data: [1] }) }))
    try {
      await insecureFetch(server.url + '/estateSell/list', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({ houseIds: [5139395] }),
      })
      const [got] = server.received
      expect(got.method).toBe('POST')
      expect(got.url).toBe('/estateSell/list')
      expect(got.headers.authorization).toBe('Bearer tok')
      expect(JSON.parse(got.body)).toEqual({ houseIds: [5139395] })
    } finally {
      await server.close()
    }
  })

  it('проставляет Content-Length — без него сервер ждёт тело вечно', async () => {
    const server = await startServer(() => ({ body: '{}' }))
    try {
      await insecureFetch(server.url + '/x', { method: 'POST', body: '{"a":1}' })
      expect(server.received[0].headers['content-length']).toBe('7')
    } finally {
      await server.close()
    }
  })

  it('разбирает json и отдаёт ok на 2xx', async () => {
    const server = await startServer(() => ({ body: JSON.stringify({ data: [{ id: 7 }] }) }))
    try {
      const res = await insecureFetch(server.url + '/x', { method: 'POST', body: '{}' })
      expect(res.ok).toBe(true)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ data: [{ id: 7 }] })
    } finally {
      await server.close()
    }
  })

  it('на 4xx отдаёт ok=false и тело текстом', async () => {
    const server = await startServer(() => ({ status: 401, body: '{"error":"нет доступа"}' }))
    try {
      const res = await insecureFetch(server.url + '/x', { method: 'POST', body: '{}' })
      expect(res.ok).toBe(false)
      expect(res.status).toBe(401)
      expect(await res.text()).toContain('нет доступа')
    } finally {
      await server.close()
    }
  })

  it('строка запроса доезжает до сервера', async () => {
    const server = await startServer(() => ({ body: '{}' }))
    try {
      await insecureFetch(server.url + '/x?a=1&b=2', { method: 'GET' })
      expect(server.received[0].url).toBe('/x?a=1&b=2')
    } finally {
      await server.close()
    }
  })

  it('обрыв соединения приходит отказом, а не зависанием', async () => {
    // Порт, на котором никто не слушает.
    await expect(insecureFetch('http://127.0.0.1:1/x', { method: 'POST', body: '{}' }))
      .rejects.toThrow()
  })

  it('abort прекращает запрос', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      insecureFetch('http://127.0.0.1:1/x', { method: 'POST', body: '{}', signal: controller.signal })
    ).rejects.toThrow()
  })

  it('Request как вход не поддерживается — это не полная замена fetch', async () => {
    await expect(insecureFetch({} as any)).rejects.toThrow(/только URL строкой/)
  })
})

describe('выбор режима в MacroHttp', () => {
  const options = { baseUrl: 'https://api.x/v2', token: 't' }

  it('по умолчанию используется обычный fetch с проверкой сертификата', () => {
    const client = new MacroHttp(options)
    expect((client as any).fetchImpl).toBe(fetch)
  })

  it('флаг переключает на транспорт без проверки', () => {
    const client = new MacroHttp({ ...options, allowExpiredCertificate: true })
    expect((client as any).fetchImpl).toBe(insecureFetch)
  })

  it('явный fetchImpl из тестов флагом не подменяется', () => {
    const stub = (async () => new Response('{}')) as unknown as typeof fetch
    const client = new MacroHttp({ ...options, allowExpiredCertificate: true, fetchImpl: stub })
    expect((client as any).fetchImpl).toBe(stub)
  })

  it('работает через MacroHttp целиком: запрос уходит и ответ разбирается', async () => {
    const server = await startServer(() => ({ body: JSON.stringify({ data: [1, 2], meta: { next: null } }) }))
    try {
      const client = new MacroHttp({
        baseUrl: server.url,
        token: 'tok',
        allowExpiredCertificate: true,
        minIntervalMs: 0,
      })
      const out = await client.postAll<number>('/estateSell/list', { houseIds: [1] })
      expect(out).toEqual([1, 2])
      expect(server.received[0].headers.authorization).toBe('Bearer tok')
    } finally {
      await server.close()
    }
  })
})
