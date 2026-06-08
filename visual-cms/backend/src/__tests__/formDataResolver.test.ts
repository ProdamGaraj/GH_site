import { FORM_DATA_RESOLVER_JS } from '../services/runtime/formDataResolver'

/**
 * Собираем РЕАЛЬНЫЙ резолвер из того же JS-исходника, что встраивается в страницу,
 * подменяя window/document моками. Так тест проверяет ровно тот код, что задеплоится.
 */
function makeResolver(win: any, doc: any): (source: any) => unknown {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function('window', 'document', FORM_DATA_RESOLVER_JS + '\nreturn resolveFormData;')
  return factory(win, doc)
}

describe('form-data resolver (runtime JS)', () => {
  describe('url-params', () => {
    it('возвращает значение по ключу', () => {
      const resolve = makeResolver({ location: { search: '?category=villa&page=2' } }, {})
      expect(resolve({ formDataType: 'url-params', formDataKey: 'category' })).toBe('villa')
    })

    it('отсутствующий ключ → default', () => {
      const resolve = makeResolver({ location: { search: '?a=1' } }, {})
      expect(resolve({ formDataType: 'url-params', formDataKey: 'missing', formDataDefault: 'all' })).toBe('all')
    })

    it('без ключа → объект всех параметров', () => {
      const resolve = makeResolver({ location: { search: '?a=1&b=2' } }, {})
      expect(resolve({ formDataType: 'url-params' })).toEqual({ a: '1', b: '2' })
    })

    it('пустой query и нет ключа → пустой объект', () => {
      const resolve = makeResolver({ location: { search: '' } }, {})
      expect(resolve({ formDataType: 'url-params' })).toEqual({})
    })
  })

  describe('local-storage / session-storage', () => {
    it('JSON-значение парсится', () => {
      const resolve = makeResolver({ localStorage: { getItem: (k: string) => (k === 'prefs' ? '{"x":1}' : null) } }, {})
      expect(resolve({ formDataType: 'local-storage', formDataKey: 'prefs' })).toEqual({ x: 1 })
    })

    it('не-JSON значение возвращается строкой', () => {
      const resolve = makeResolver({ localStorage: { getItem: () => 'plain-text' } }, {})
      expect(resolve({ formDataType: 'local-storage', formDataKey: 'k' })).toBe('plain-text')
    })

    it('отсутствующий ключ → default', () => {
      const resolve = makeResolver({ localStorage: { getItem: () => null } }, {})
      expect(resolve({ formDataType: 'local-storage', formDataKey: 'k', formDataDefault: 'd' })).toBe('d')
    })

    it('без ключа → default', () => {
      const resolve = makeResolver({ localStorage: { getItem: () => 'x' } }, {})
      expect(resolve({ formDataType: 'local-storage', formDataDefault: 'fallback' })).toBe('fallback')
    })

    it('session-storage читается отдельно от local-storage', () => {
      const resolve = makeResolver({ sessionStorage: { getItem: (k: string) => (k === 'cart' ? '42' : null) } }, {})
      expect(resolve({ formDataType: 'session-storage', formDataKey: 'cart' })).toBe(42)
    })
  })

  describe('cookies', () => {
    it('значение по имени с decodeURIComponent', () => {
      const resolve = makeResolver({}, { cookie: 'session_token=abc%20123; theme=dark' })
      expect(resolve({ formDataType: 'cookies', formDataKey: 'session_token' })).toBe('abc 123')
    })

    it('отсутствующая cookie → default', () => {
      const resolve = makeResolver({}, { cookie: 'a=1' })
      expect(resolve({ formDataType: 'cookies', formDataKey: 'x', formDataDefault: 'none' })).toBe('none')
    })

    it('пустой document.cookie → default', () => {
      const resolve = makeResolver({}, { cookie: '' })
      expect(resolve({ formDataType: 'cookies', formDataKey: 'x', formDataDefault: 'd' })).toBe('d')
    })
  })

  describe('default / устойчивость к ошибкам', () => {
    it('значения нет и default не задан → null', () => {
      const resolve = makeResolver({ location: { search: '' } }, {})
      expect(resolve({ formDataType: 'url-params', formDataKey: 'x' })).toBe(null)
    })

    it('неизвестный formDataType → default', () => {
      const resolve = makeResolver({}, {})
      expect(resolve({ formDataType: 'weird', formDataDefault: 'fallback' })).toBe('fallback')
    })

    it('исключение внутри (нет storage в window) → default, без throw', () => {
      const resolve = makeResolver({}, {})
      expect(resolve({ formDataType: 'local-storage', formDataKey: 'k', formDataDefault: 'safe' })).toBe('safe')
    })

    it('default может быть структурой (объект)', () => {
      const resolve = makeResolver({ location: { search: '' } }, {})
      expect(resolve({ formDataType: 'url-params', formDataKey: 'x', formDataDefault: { a: 1 } })).toEqual({ a: 1 })
    })
  })
})
