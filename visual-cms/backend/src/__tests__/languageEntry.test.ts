/**
 * Точка входа без языкового префикса.
 *
 * Корневые адреса перестают быть русской версией и становятся
 * распознавателем: выбирают язык и уводят на `/<lang>/<path>`. Ошибка здесь
 * стоит дорого — это вход на весь сайт, и зацикленный редирект запер бы
 * посетителя на пустой странице.
 */
import {
  pickLanguage,
  normalizeEntryPath,
  generateLanguageEntryStub,
  LANG_STORAGE_KEY,
} from '../services/languageEntry'

describe('normalizeEntryPath', () => {
  it('главная — просто слеш', () => {
    expect(normalizeEntryPath('')).toBe('/')
    expect(normalizeEntryPath('/')).toBe('/')
  })
  it('обычная страница получает слеши с обеих сторон', () => {
    expect(normalizeEntryPath('about')).toBe('/about/')
    expect(normalizeEntryPath('/about')).toBe('/about/')
    expect(normalizeEntryPath('about/')).toBe('/about/')
  })
  it('вложенный путь коллекции сохраняется целиком', () => {
    expect(normalizeEntryPath('complex/harizma')).toBe('/complex/harizma/')
  })
})

describe('pickLanguage', () => {
  const available = ['ru', 'uz']

  it('сохранённый выбор побеждает язык браузера', () => {
    expect(pickLanguage('uz', ['ru-RU', 'ru'], available, 'ru')).toBe('uz')
  })

  it('без выбора берётся первый подходящий язык браузера', () => {
    expect(pickLanguage(null, ['uz-UZ', 'ru'], available, 'ru')).toBe('uz')
    expect(pickLanguage(null, ['ru-RU'], available, 'ru')).toBe('ru')
  })

  it('регион отбрасывается: uz-Latn-UZ — это uz', () => {
    expect(pickLanguage(null, ['uz-Latn-UZ'], available, 'ru')).toBe('uz')
  })

  it('язык браузера, которого на сайте нет, пропускается', () => {
    expect(pickLanguage(null, ['de-DE', 'uz'], available, 'ru')).toBe('uz')
  })

  it('ничего не подошло — язык по умолчанию', () => {
    expect(pickLanguage(null, ['de', 'fr'], available, 'ru')).toBe('ru')
    expect(pickLanguage(null, [], available, 'ru')).toBe('ru')
  })

  it('сохранённый язык, которого больше нет на сайте, игнорируется', () => {
    expect(pickLanguage('en', ['de'], available, 'ru')).toBe('ru')
  })

  it('мусор в navigator.languages не ломает выбор', () => {
    expect(pickLanguage(null, ['', null as unknown as string, 'uz'], available, 'ru')).toBe('uz')
  })
})

describe('generateLanguageEntryStub', () => {
  const html = generateLanguageEntryStub({
    languages: ['ru', 'uz'],
    defaultLanguage: 'ru',
    pagePath: 'complex/harizma',
    title: 'Harizma',
  })

  it('уводит на язык с сохранением пути', () => {
    expect(html).toContain('"/complex/harizma/"')
    expect(html).toContain("location.replace('/' + (pick || def) + target)")
  })

  it('replace, а не href — иначе «Назад» зацикливало бы переход', () => {
    expect(html).toContain('location.replace')
    expect(html).not.toContain('location.href =')
  })

  it('без JS уводит на язык по умолчанию', () => {
    expect(html).toContain('<noscript><meta http-equiv="refresh" content="0; url=/ru/complex/harizma/">')
  })

  it('не индексируется и указывает канонический адрес', () => {
    expect(html).toContain('name="robots" content="noindex,follow"')
    expect(html).toContain('rel="canonical" href="/ru/complex/harizma/"')
  })

  it('перечисляет языковые версии для поисковиков', () => {
    expect(html).toContain('hreflang="ru" href="/ru/complex/harizma/"')
    expect(html).toContain('hreflang="uz" href="/uz/complex/harizma/"')
    expect(html).toContain('hreflang="x-default"')
  })

  it('читает сохранённый выбор тем же ключом, что пишет переключатель', () => {
    expect(html).toContain(JSON.stringify(LANG_STORAGE_KEY))
    expect(html).toContain('try { saved = localStorage.getItem')
  })

  it('главная уводит в корень языка', () => {
    const home = generateLanguageEntryStub({
      languages: ['ru', 'uz'],
      defaultLanguage: 'ru',
      pagePath: '',
    })
    expect(home).toContain('var target = "/"')
    expect(home).toContain('href="/ru/"')
  })

  it('скрипт действительно выбирает язык — исполняем его', () => {
    const script = html.slice(html.indexOf('(function(){'), html.indexOf('})();') + 5)
    const calls: string[] = []
    const fn = new Function(
      'navigator',
      'localStorage',
      'location',
      script
    )
    fn(
      { languages: ['uz-UZ', 'ru'] },
      { getItem: () => null },
      { replace: (u: string) => calls.push(u) }
    )
    expect(calls).toEqual(['/uz/complex/harizma/'])
  })

  it('сохранённый выбор побеждает и в исполнении', () => {
    const script = html.slice(html.indexOf('(function(){'), html.indexOf('})();') + 5)
    const calls: string[] = []
    new Function('navigator', 'localStorage', 'location', script)(
      { languages: ['uz-UZ'] },
      { getItem: () => 'ru' },
      { replace: (u: string) => calls.push(u) }
    )
    expect(calls).toEqual(['/ru/complex/harizma/'])
  })

  it('недоступный localStorage не ломает переход', () => {
    const script = html.slice(html.indexOf('(function(){'), html.indexOf('})();') + 5)
    const calls: string[] = []
    new Function('navigator', 'localStorage', 'location', script)(
      { languages: ['de'] },
      {
        getItem: () => {
          throw new Error('заблокировано')
        },
      },
      { replace: (u: string) => calls.push(u) }
    )
    expect(calls).toEqual(['/ru/complex/harizma/'])
  })
})
