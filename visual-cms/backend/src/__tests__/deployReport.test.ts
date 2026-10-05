/**
 * Отчёт сервису о деплое коллекции: адрес и токен — из окружения backend по
 * ключу интеграции; сбой — предупреждение, а не ошибка деплоя.
 */
import { isDeployReportTarget, reportCollectionDeploy } from '../services/deployReport'

const env = { ...process.env }
afterEach(() => {
  process.env = { ...env }
})

function okFetch() {
  return jest.fn(async () => ({ ok: true, status: 200 }) as Response)
}

describe('reportCollectionDeploy', () => {
  it('по запросу на язык: адрес сервиса, токен в заголовке, адреса элементов', async () => {
    process.env.NEWS_SERVICE_URL = 'http://news-service:5200/'
    process.env.NEWS_WRITE_TOKEN = 'secret'
    const fetchImpl = okFetch()
    const warnings = await reportCollectionDeploy(
      'news-service',
      new Map([
        ['ru', ['a', 'b']],
        ['uz', []],
      ]),
      fetchImpl as unknown as typeof fetch
    )
    expect(warnings).toEqual([])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://news-service:5200/api/admin/deployed')
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json', 'X-News-Token': 'secret' } })
    expect(JSON.parse(String(init.body))).toEqual({ locale: 'ru', slugs: ['a', 'b'] })
    expect(JSON.parse(String((fetchImpl.mock.calls[1] as unknown as [string, RequestInit])[1].body))).toEqual({ locale: 'uz', slugs: [] })
  })

  it('нет адреса или токена — предупреждение, запросов нет', async () => {
    delete process.env.NEWS_SERVICE_URL
    process.env.NEWS_WRITE_TOKEN = 'secret'
    const fetchImpl = okFetch()
    const warnings = await reportCollectionDeploy('news-service', new Map([['ru', ['a']]]), fetchImpl as unknown as typeof fetch)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/^Отчёт о деплое \(news-service\) не отправлен/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('ответ с ошибкой и сбой сети — предупреждения по языкам, остальные языки отправляются', async () => {
    process.env.NEWS_SERVICE_URL = 'http://news-service:5200'
    process.env.NEWS_WRITE_TOKEN = 'secret'
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ ok: true, status: 200 })
    const warnings = await reportCollectionDeploy(
      'news-service',
      new Map([
        ['ru', ['a']],
        ['uz', ['a']],
        ['en', []],
      ]),
      fetchImpl as unknown as typeof fetch
    )
    expect(warnings).toEqual(['Отчёт о деплое (news-service, ru): HTTP 401', 'Отчёт о деплое (news-service, uz): ECONNREFUSED'])
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })
})

describe('isDeployReportTarget', () => {
  it('только известные интеграции — не произвольный адрес', () => {
    expect(isDeployReportTarget('news-service')).toBe(true)
    expect(isDeployReportTarget('http://evil.example/hook')).toBe(false)
    expect(isDeployReportTarget(null)).toBe(false)
    expect(isDeployReportTarget(undefined)).toBe(false)
  })
})
