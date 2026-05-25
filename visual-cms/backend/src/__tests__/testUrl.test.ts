import { resolveTestUrl } from '../utils/testUrl'

describe('resolveTestUrl', () => {
  const base = 'https://api.example.com'

  it('пустой testEndpoint → базовый URL', () => {
    expect(resolveTestUrl(base, undefined)).toBe(base)
    expect(resolveTestUrl(base, '')).toBe(base)
    expect(resolveTestUrl(base, '   ')).toBe(base)
  })

  it('абсолютный URL используется как есть', () => {
    expect(resolveTestUrl(base, 'https://other.com/ping')).toBe('https://other.com/ping')
    expect(resolveTestUrl(base, 'http://h.local/health')).toBe('http://h.local/health')
  })

  it('относительный путь добавляется к базе с путём (сохраняет /v2)', () => {
    // Ключевой кейс: new URL отбросил бы /v2; добавление — нет.
    expect(resolveTestUrl('https://api.macrocrm.gh.uz/v2', 'tools/list')).toBe('https://api.macrocrm.gh.uz/v2/tools/list')
  })

  it('добавляется к базе независимо от ведущего слэша и хвостового слэша базы', () => {
    expect(resolveTestUrl('https://api.example.com/v2', '/tools/list')).toBe('https://api.example.com/v2/tools/list')
    expect(resolveTestUrl('https://api.example.com/v2/', 'tools/list')).toBe('https://api.example.com/v2/tools/list')
  })

  it('относительный путь к чистому origin', () => {
    expect(resolveTestUrl('https://api.example.com', '/health')).toBe('https://api.example.com/health')
    expect(resolveTestUrl('https://api.example.com', 'health')).toBe('https://api.example.com/health')
  })

  it('обрезает пробелы вокруг testEndpoint', () => {
    expect(resolveTestUrl(base, '  /health  ')).toBe('https://api.example.com/health')
  })

  it('сохраняет query-параметры в testEndpoint', () => {
    expect(resolveTestUrl('https://api.example.com/v2', 'search?q=1')).toBe('https://api.example.com/v2/search?q=1')
  })
})
