/**
 * Рантайм подсветки текущей страницы в меню: генерируется валидный JS,
 * матчинг проверяем выполнением функции norm/isActive в песочнице.
 */
import { generateActiveLinkRuntime } from '../services/ActiveLinkRuntime'

const runtime = generateActiveLinkRuntime()

describe('generateActiveLinkRuntime', () => {
  it('содержит <style> с классом и <script>', () => {
    expect(runtime).toContain('.vcms-active-link')
    expect(runtime).toContain('<script>')
    expect(runtime).toContain("aria-current")
  })

  it('является валидным JS', () => {
    const body = runtime.replace(/^[\s\S]*?<script>/, '').replace(/<\/script>\s*$/, '')
    expect(() => new Function(body)).not.toThrow()
  })

  describe('логика матчинга (isActive/norm в песочнице)', () => {
    // Достаём norm/isActive, подсовывая location и обрезая DOM-часть
    const buildMatcher = (pathname: string) => {
      const body = runtime.replace(/^[\s\S]*?<script>/, '').replace(/<\/script>\s*$/, '')
      // Вырезаем IIFE-обёртку и apply/DOM: исполняем до объявления selector
      const inner = body
        .replace(/^\s*\(function\(\)\{\s*'use strict';/, '')
        .split('var selector')[0]
      const fn = new Function('location', `${inner}; return { norm: norm, isActive: isActive };`)
      return fn({ pathname, host: 'site.uz', href: 'https://site.uz' + pathname })
    }

    const url = (href: string, base = 'https://site.uz/contacts/') => new URL(href, base)

    it.each([
      ['/contacts/', '/contacts', true],
      ['/contacts/', '/contacts/', true],
      ['/contacts/', '/contacts.html', true],
      ['/contacts/', '/about', false],
      ['/en/contacts', '/contacts', true],   // языковой префикс
      ['/mycontacts', '/contacts', false],   // граница сегмента
    ])('pathname=%s href=%s → %s', (pathname, href, expected) => {
      const m = buildMatcher(pathname)
      expect(m.isActive(url(href))).toBe(expected)
    })

    it('главная: index.html#top активна на /, секционный якорь — нет', () => {
      const m = buildMatcher('/')
      expect(m.isActive(url('/index.html#top'))).toBe(true)
      expect(m.isActive(url('/index.html#complexes'))).toBe(false)
      expect(m.isActive(url('/'))).toBe(true)
    })

    it('главная активна и на языковом корне /en', () => {
      const m = buildMatcher('/en')
      expect(m.isActive(url('/'))).toBe(true)
    })

    it('чужой хост не активен', () => {
      const m = buildMatcher('/contacts')
      expect(m.isActive(new URL('https://other.uz/contacts'))).toBe(false)
    })
  })
})
