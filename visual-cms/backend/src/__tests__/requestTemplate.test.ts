/**
 * TemplateEngine: ссылки, фильтры, типы, ошибки синтаксиса и попытки
 * подсунуть разметку шаблона в данных посетителя.
 */
import {
  parseTemplateString,
  renderTemplate,
  renderTemplateString,
  renderTemplateText,
  templateIssues,
  templateRefs,
  TemplateSyntaxError,
  type TemplateContext,
} from '../services/requests/template'

const ctx = (form: Record<string, unknown> = {}): TemplateContext => ({
  form,
  page: { path: '/ru/', lang: 'ru', title: 'Главная' },
  visitor: { referrer: 'https://google.com', utm: { source: 'ig' } },
  request: { ip: '203.0.113.7', domain: 'gh.uz', userAgent: 'UA' },
  now: new Date('2026-11-18T09:30:00Z'),
})

describe('разбор строки', () => {
  it('текст и ссылки по порядку', () => {
    expect(parseTemplateString('Имя: {{form.name}}, тел {{ form.phone | digits }}')).toEqual([
      { text: 'Имя: ' },
      { ref: { path: 'form.name', namespace: 'form', segments: ['name'], filters: [] } },
      { text: ', тел ' },
      { ref: { path: 'form.phone', namespace: 'form', segments: ['phone'], filters: [{ name: 'digits' }] } },
    ])
  })

  it('параметр фильтра в кавычках может содержать «}}» и «|»', () => {
    const [part] = parseTemplateString('{{form.x | default:"a}}|b"}}')
    expect(part).toEqual({ ref: expect.objectContaining({ filters: [{ name: 'default', arg: 'a}}|b' }] }) })
  })

  it('числовой и одинарный-кавычки параметр', () => {
    expect(parseTemplateString("{{form.x|default:5}}")[0]).toMatchObject({ ref: { filters: [{ name: 'default', arg: 5 }] } })
    expect(parseTemplateString("{{form.x|default:'n/a'}}")[0]).toMatchObject({ ref: { filters: [{ name: 'default', arg: 'n/a' }] } })
  })

  it.each([
    ['{{form.name', 'Незакрытая ссылка'],
    ['{{secret.token}}', 'Нет данных «secret»'],
    ['{{form.name | eval}}', 'Нет фильтра «eval»'],
    ['{{form.name | default}}', 'нужен параметр'],
    ['{{form.name | trim:"x"}}', 'без параметра'],
    ['{{form.a b}}', 'Непонятная ссылка'],
    ['{{form..a}}', 'Непонятная ссылка'],
    ['{{}}', 'Непонятная ссылка'],
  ])('ошибка: %s', (template, message) => {
    expect(() => parseTemplateString(template)).toThrow(TemplateSyntaxError)
    expect(() => parseTemplateString(template)).toThrow(message)
  })

  it('templateIssues собирает ошибки всего дерева, templateRefs — ссылки', () => {
    expect(templateIssues({ a: '{{form.x}}', b: ['{{bad.y}}', 3] })).toEqual([expect.stringContaining('Нет данных «bad»')])
    expect(templateIssues({ a: 'ok', b: 1 })).toEqual([])
    expect(templateRefs({ a: '{{form.x}}', b: ['{{page.lang}} {{now}}'] }).map((r) => r.path)).toEqual(['form.x', 'page.lang', 'now'])
  })
})

describe('подстановка', () => {
  it('лист целиком ссылка — значение с типом', () => {
    const c = ctx({ n: 5, list: [1, 2], obj: { a: 1 }, yes: true })
    expect(renderTemplateString('{{form.n}}', c)).toBe(5)
    expect(renderTemplateString('{{form.list}}', c)).toEqual([1, 2])
    expect(renderTemplateString('{{form.obj}}', c)).toEqual({ a: 1 })
    expect(renderTemplateString('{{form.yes}}', c)).toBe(true)
    expect(renderTemplateString(' {{form.n}}', c)).toBe(' 5') // с текстом — строка
  })

  it('нет значения: целиком — null, в тексте — пусто', () => {
    expect(renderTemplateString('{{form.none}}', ctx())).toBeNull()
    expect(renderTemplateString('a{{form.none}}b', ctx())).toBe('ab')
  })

  it('{{form}} — вся форма; вложенные пути и индексы массивов', () => {
    const c = ctx({ a: 1, items: [{ id: 'x' }] })
    expect(renderTemplateString('{{form}}', c)).toEqual({ a: 1, items: [{ id: 'x' }] })
    expect(renderTemplateString('{{form.items.0.id}}', c)).toBe('x')
  })

  it('page, visitor, request, now', () => {
    const c = ctx()
    expect(renderTemplateText('{{page.lang}} {{visitor.utm.source}} {{request.domain}}', c)).toBe('ru ig gh.uz')
    expect(renderTemplateString('{{now}}', c)).toBe('2026-11-18T09:30:00.000Z')
    expect(renderTemplateString('{{now.date}}', c)).toBe('2026-11-18')
    expect(renderTemplateString('{{now.unix}}', c)).toBe(Math.floor(Date.parse('2026-11-18T09:30:00Z') / 1000))
    expect(renderTemplateString('{{now.year}}', c)).toBeNull()
  })

  it('прототип объекта недоступен', () => {
    expect(renderTemplateString('{{form.constructor}}', ctx({}))).toBeNull()
    expect(renderTemplateString('{{form.__proto__}}', ctx({}))).toBeNull()
  })

  it('объект в тексте — JSON', () => {
    expect(renderTemplateText('x={{form.o}}', ctx({ o: { a: 1 } }))).toBe('x={"a":1}')
  })
})

describe('фильтры', () => {
  const c = ctx({ phone: '+998 (90) 123-45-67', empty: '', num: ' 12,5 ', bad: 'abc', on: 'on', no: 'нет', name: '  Иван ', mixed: 'АбВ' })
  it.each([
    ['{{form.phone | digits}}', '998901234567'],
    ['{{form.empty | default:"—"}}', '—'],
    ['{{form.none | default:0}}', 0],
    ['{{form.name | default:"x"}}', '  Иван '],
    ['{{form.num | number}}', 12.5],
    ['{{form.bad | number}}', null],
    ['{{form.empty | number}}', null],
    ['{{form.on | bool}}', true],
    ['{{form.no | bool}}', false],
    ['{{form.name | trim}}', 'Иван'],
    ['{{form.mixed | lower}}', 'абв'],
    ['{{form.mixed | upper}}', 'АБВ'],
    ['{{form.phone | digits | number}}', 998901234567],
  ])('%s → %p', (template, expected) => {
    expect(renderTemplateString(template, c)).toEqual(expected)
  })

  it('json — значение строкой JSON', () => {
    expect(renderTemplateString('{{form.o | json}}', ctx({ o: { a: [1] } }))).toBe('{"a":[1]}')
  })
})

describe('дерево шаблона', () => {
  it('ключи не шаблонизируются, значения — с типами; константы как есть', () => {
    const out = renderTemplate(
      { phones: ['{{form.phone | digits}}'], '{{form.key}}': 'v', action: 'buy', n: 3, ok: true, none: null, utm: { s: '{{visitor.utm.source}}' } },
      ctx({ phone: '90 123', key: 'injected' }),
    )
    expect(out).toEqual({ phones: ['90123'], '{{form.key}}': 'v', action: 'buy', n: 3, ok: true, none: null, utm: { s: 'ig' } })
  })

  it('данные посетителя с разметкой шаблона и JSON не ломают структуру', () => {
    const evil = '"}, "admin": true, "x": "{{request.ip}}'
    const out = renderTemplate({ name: '{{form.name}}', note: 'Имя: {{form.name}}' }, ctx({ name: evil })) as Record<string, string>
    expect(Object.keys(out)).toEqual(['name', 'note'])
    expect(out.name).toBe(evil) // строка как есть, без повторной подстановки
    expect(out.note).toBe(`Имя: ${evil}`)
    expect(JSON.parse(JSON.stringify(out))).toEqual(out)
  })

  it('кодирование вставок в текст (для пути URL)', () => {
    expect(renderTemplateText('/c/{{form.id}}', ctx({ id: 'a/b?c' }), encodeURIComponent)).toBe('/c/a%2Fb%3Fc')
  })
})
