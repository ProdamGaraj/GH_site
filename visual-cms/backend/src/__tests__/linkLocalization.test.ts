/**
 * Префикс языка во внутренних ссылках.
 *
 * Баг, ради которого это написано: на `/uz/` все 38 внутренних ссылок вели на
 * русские адреса. Клик по меню или по карточке проекта возвращал посетителя на
 * русскую версию, хотя узбекская существовала. Ошибки не было — просто не тот
 * язык, поэтому заметить это можно было только пройдясь по ссылкам руками.
 */
import {
  isLocalizableLink,
  localizeLink,
  localizeInternalLinks,
  langPrefix,
} from '../services/linkLocalization'

describe('langPrefix', () => {
  it('дефолтный язык живёт в корне', () => {
    expect(langPrefix('ru', true)).toBe('')
  })
  it('остальные — в своём каталоге', () => {
    expect(langPrefix('uz', false)).toBe('/uz')
  })
})

describe('isLocalizableLink', () => {
  const yes = ['/', '/about', '/complex/harizma/', '/#complexes', '/buyers?tab=1', '/page.html']
  const no = [
    'https://example.com/a',
    '//cdn.example.com/x.js',
    'mailto:info@gh.uz',
    'tel:+998781501111',
    '#top',
    'about',
    '',
    '/media/abc.jpg',
    '/css/site.css',
    '/fonts/a.woff2',
    '/images/logo.png',
    '/api/analytics/tracker.js',
    '/assets/x.svg',
  ]

  it.each(yes)('%s — внутренняя страница', (v) => {
    expect(isLocalizableLink(v, '/uz')).toBe(true)
  })

  it.each(no)('%s — не трогаем', (v) => {
    expect(isLocalizableLink(v, '/uz')).toBe(false)
  })

  it('уже с префиксом — второй раз не добавляем', () => {
    expect(isLocalizableLink('/uz/about', '/uz')).toBe(false)
    expect(isLocalizableLink('/uz', '/uz')).toBe(false)
    expect(isLocalizableLink('/uz#top', '/uz')).toBe(false)
  })

  it('похожий на префикс путь не путается с ним', () => {
    // «/uzbekistan» начинается с «/uz», но это другая страница.
    expect(isLocalizableLink('/uzbekistan', '/uz')).toBe(true)
  })
})

describe('localizeLink', () => {
  it('корень получает слеш после префикса', () => {
    expect(localizeLink('/', '/uz')).toBe('/uz/')
  })
  it('обычный путь', () => {
    expect(localizeLink('/about', '/uz')).toBe('/uz/about')
    expect(localizeLink('/complex/harizma/', '/uz')).toBe('/uz/complex/harizma/')
  })
  it('якорь на главной остаётся якорем', () => {
    expect(localizeLink('/#complexes', '/uz')).toBe('/uz/#complexes')
  })
  it('строка запроса сохраняется', () => {
    expect(localizeLink('/buyers?tab=1', '/uz')).toBe('/uz/buyers?tab=1')
  })
  it('пустой префикс — дефолтный язык, ничего не меняется', () => {
    expect(localizeLink('/about', '')).toBe('/about')
  })
  it('статика и внешние адреса не трогаются', () => {
    expect(localizeLink('/media/a.jpg', '/uz')).toBe('/media/a.jpg')
    expect(localizeLink('https://gh.uz', '/uz')).toBe('https://gh.uz')
  })
})

const tree = {
  id: 'root',
  attributes: { class: 'page' },
  children: [
    { id: 'nav', attributes: { href: '/about', class: 'link' } },
    { id: 'home', attributes: { href: '/' } },
    { id: 'card', attributes: { 'data-href': '/complex/harizma/', href: '/complex/harizma/' } },
    { id: 'img', attributes: { src: '/media/a.jpg', href: '/media/a.jpg' } },
    { id: 'ext', attributes: { href: 'https://gh.uz' } },
    { id: 'tel', attributes: { href: 'tel:+998781501111' } },
    { id: 'anchor', attributes: { href: '/#complexes' } },
    {
      id: 'deep',
      children: [{ id: 'deeper', attributes: { href: '/news' } }],
      variations: { mobile: { specificChildren: [{ id: 'mob', attributes: { href: '/contact' } }] } },
    },
  ],
}

describe('localizeInternalLinks', () => {
  const { value, count } = localizeInternalLinks(tree, '/uz')
  const byId = (id: string): any => {
    const stack: any[] = [value]
    while (stack.length) {
      const n = stack.pop()
      if (n?.id === id) return n
      for (const c of n?.children ?? []) stack.push(c)
      for (const v of Object.values(n?.variations ?? {}) as any[]) {
        for (const c of v?.specificChildren ?? []) stack.push(c)
      }
    }
    return undefined
  }

  it('переписывает ссылки на страницы, включая вложенные и вариации', () => {
    expect(byId('nav').attributes.href).toBe('/uz/about')
    expect(byId('home').attributes.href).toBe('/uz/')
    expect(byId('anchor').attributes.href).toBe('/uz/#complexes')
    expect(byId('deeper').attributes.href).toBe('/uz/news')
    expect(byId('mob').attributes.href).toBe('/uz/contact')
  })

  it('data-href тоже — по нему кликает карточка проекта', () => {
    expect(byId('card').attributes['data-href']).toBe('/uz/complex/harizma/')
    expect(byId('card').attributes.href).toBe('/uz/complex/harizma/')
  })

  it('медиа, внешние адреса и tel не трогает', () => {
    expect(byId('img').attributes.href).toBe('/media/a.jpg')
    expect(byId('img').attributes.src).toBe('/media/a.jpg')
    expect(byId('ext').attributes.href).toBe('https://gh.uz')
    expect(byId('tel').attributes.href).toBe('tel:+998781501111')
  })

  it('считает сделанные замены', () => {
    expect(count).toBe(7)
  })

  it('соседние атрибуты целы', () => {
    expect(byId('nav').attributes.class).toBe('link')
  })

  it('исходное дерево не мутируется', () => {
    expect(tree.children[0].attributes!.href).toBe('/about')
  })

  it('повторный прогон ничего не меняет', () => {
    const again = localizeInternalLinks(value, '/uz')
    expect(again.count).toBe(0)
    expect(again.value).toEqual(value)
  })

  it('пустой префикс — дерево возвращается как есть', () => {
    const same = localizeInternalLinks(tree, '')
    expect(same.count).toBe(0)
    expect(same.value).toBe(tree)
  })
})
