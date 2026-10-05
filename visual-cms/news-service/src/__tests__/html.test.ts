/**
 * Граница безопасности: HTML секций вставляется на сайт как есть, поэтому
 * всё опасное должно вырезаться при записи, а разрешённое — сохраняться.
 */
import { hasText, plainText, sanitizeRichText } from '../services/html'

describe('sanitizeRichText — вредное вырезается', () => {
  it.each([
    ['script', '<p>Привет</p><script>alert(1)</script>', '<p>Привет</p>'],
    ['обработчик события', '<p onclick="alert(1)">Текст</p>', '<p>Текст</p>'],
    ['onerror у картинки (img вне списка)', '<img src=x onerror="alert(1)">Текст', 'Текст'],
    ['атрибут style', '<p style="position:fixed;top:0">Текст</p>', '<p>Текст</p>'],
    ['iframe', '<iframe src="https://evil.example"></iframe><p>Ок</p>', '<p>Ок</p>'],
    ['style-блок', '<style>body{display:none}</style><p>Ок</p>', '<p>Ок</p>'],
    ['svg с скриптом', '<svg><script>alert(1)</script></svg><p>Ок</p>', '<p>Ок</p>'],
    ['form/input', '<form action="/x"><input name="a"></form><p>Ок</p>', '<p>Ок</p>'],
  ])('%s', (_name, input, expected) => {
    expect(sanitizeRichText(input)).toBe(expected)
  })

  it.each([
    ['javascript:', '<a href="javascript:alert(1)">ссылка</a>'],
    ['JaVaScRiPt: с пробелами', '<a href=" JaVaScRiPt:alert(1)">ссылка</a>'],
    ['data:', '<a href="data:text/html;base64,PHNjcmlwdD4=">ссылка</a>'],
    ['vbscript:', '<a href="vbscript:msgbox(1)">ссылка</a>'],
    ['протокол-относительный //', '<a href="//evil.example/x">ссылка</a>'],
  ])('ссылка %s теряет href, текст остаётся', (_name, input) => {
    const out = sanitizeRichText(input)
    expect(out).not.toMatch(/href=/)
    expect(out).toContain('ссылка')
  })
})

describe('sanitizeRichText — разрешённое сохраняется', () => {
  it('разметка визуального редактора: абзацы, жирный, курсив, списки, подзаголовки, цитата', () => {
    const html =
      '<h2>Заголовок</h2><p><strong>Жирный</strong> и <em>курсив</em>, <u>подчёркнутый</u>, <s>зачёркнутый</s><br>перенос</p>' +
      '<ul><li><p>Пункт</p></li></ul><ol><li>Первый</li></ol><h3>Подзаголовок</h3><blockquote><p>Цитата</p></blockquote>'
    // <br> → <br /> — то же самое; повторная чистка его не меняет (см. ниже).
    expect(sanitizeRichText(html)).toBe(html.replace('<br>', '<br />'))
  })

  it('<b>/<i> приводятся к <strong>/<em> (импорт Telegram)', () => {
    expect(sanitizeRichText('<b>a</b> <i>b</i>')).toBe('<strong>a</strong> <em>b</em>')
  })

  it('внешняя ссылка — новая вкладка и rel=noopener noreferrer; лишние атрибуты отбрасываются', () => {
    expect(sanitizeRichText('<a href="https://gh.uz/ru/" class="x" rel="nofollow" target="_self">сайт</a>')).toBe(
      '<a href="https://gh.uz/ru/" target="_blank" rel="noopener noreferrer">сайт</a>'
    )
  })

  it('внутренняя, почтовая и телефонная ссылки — без новой вкладки', () => {
    expect(sanitizeRichText('<a href="/ru/complex/harizma/">Harizma</a>')).toBe('<a href="/ru/complex/harizma/">Harizma</a>')
    expect(sanitizeRichText('<a href="mailto:info@gh.uz">почта</a>')).toBe('<a href="mailto:info@gh.uz">почта</a>')
    expect(sanitizeRichText('<a href="tel:+998781501111">звонок</a>')).toBe('<a href="tel:+998781501111">звонок</a>')
  })

  it('h1, div, span и таблицы снимаются, текст остаётся', () => {
    expect(sanitizeRichText('<h1>Большой</h1><div><span>текст</span></div>')).toBe('Большойтекст')
  })

  it('повторная чистка ничего не меняет', () => {
    const inputs = [
      '<p><b>a</b> <a href="https://x.uz">x</a> <a href="/y">y</a></p><script>1</script>',
      '<ul><li>1</li></ul><p onclick="x">t</p>',
    ]
    for (const input of inputs) {
      const once = sanitizeRichText(input)
      expect(sanitizeRichText(once)).toBe(once)
    }
  })

  it('пусто и null — пустая строка', () => {
    expect(sanitizeRichText('')).toBe('')
    expect(sanitizeRichText(null)).toBe('')
    expect(sanitizeRichText(undefined)).toBe('')
  })
})

describe('plainText / hasText', () => {
  it('текст без разметки, сущности раскодированы, блоки разделены пробелом', () => {
    expect(plainText('<p>Ипотека&nbsp;и&amp;рассрочка</p><p>от&#39;банка</p><ul><li>a</li><li>b</li></ul>')).toBe(
      "Ипотека и&рассрочка от'банка a b"
    )
  })

  it('пустой абзац редактора — не текст', () => {
    expect(hasText('<p></p>')).toBe(false)
    expect(hasText('<p> <br> </p>')).toBe(false)
    expect(hasText('<p>а</p>')).toBe(true)
    expect(hasText(undefined)).toBe(false)
  })
})
