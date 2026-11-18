import { describe, it, expect } from 'vitest'
import {
  bodyToText,
  defaultRequestSpec,
  insertAt,
  pairValueText,
  parseBodyText,
  refGroups,
  sampleFormData,
  withResponse,
  withRest,
} from './requestModel'

describe('defaultRequestSpec', () => {
  it('POST к адресу источника, тело — вся форма, странице — только статус', () => {
    expect(defaultRequestSpec()).toEqual({
      version: 1,
      connector: 'rest',
      rest: { method: 'POST', path: '', body: { format: 'json', value: '{{form}}' } },
      response: { expose: 'status' },
    })
  })
})

describe('withRest / withResponse', () => {
  it('меняет часть, не трогая остальное и не мутируя исходник', () => {
    const spec = defaultRequestSpec()
    const next = withRest(spec, { path: '/x' })
    expect(next.rest).toMatchObject({ method: 'POST', path: '/x' })
    expect(spec.rest!.path).toBe('')
  })

  it('GET убирает тело', () => {
    expect(withRest(defaultRequestSpec(), { method: 'GET' }).rest!.body).toEqual({ format: 'none' })
  })

  it('ответ: без ответа в спецификации — от «статуса»', () => {
    const spec = { ...defaultRequestSpec(), response: undefined }
    expect(withResponse(spec, { expose: 'fields' }).response).toEqual({ expose: 'fields' })
  })
})

it('refGroups: поля формы блока первыми, затем страница/визит и сервер', () => {
  const groups = refGroups(['name', 'phone'])
  expect(groups.map((g) => g.title)).toEqual(['Форма', 'Страница и визит', 'Сервер'])
  expect(groups[0].refs.map((r) => r.ref)).toEqual(['form.name', 'form.phone', 'form'])
  expect(groups.flatMap((g) => g.refs.map((r) => r.ref))).toContain('visitor.utm.source')
})

describe('insertAt', () => {
  it('вставка в курсор и вместо выделения', () => {
    expect(insertAt('ab', 1, 1, 'X')).toEqual({ value: 'aXb', cursor: 2 })
    expect(insertAt('abcd', 1, 3, 'X')).toEqual({ value: 'aXd', cursor: 2 })
  })
  it('границы за пределами строки', () => {
    expect(insertAt('ab', 10, 20, 'X')).toEqual({ value: 'abX', cursor: 3 })
    expect(insertAt('ab', -5, -1, 'X')).toEqual({ value: 'Xab', cursor: 1 })
  })
})

describe('тело JSON', () => {
  it('значение ↔ текст', () => {
    expect(bodyToText({ format: 'json', value: { a: '{{form.a}}' } })).toBe('{\n  "a": "{{form.a}}"\n}')
    expect(bodyToText({ format: 'none' })).toBe('')
    expect(parseBodyText('{"a": 1}')).toEqual({ value: { a: 1 } })
    expect(parseBodyText('"{{form}}"')).toEqual({ value: '{{form}}' })
    expect(parseBodyText('  ')).toEqual({ value: {} })
  })
  it('ошибка JSON — текстом', () => {
    const r = parseBodyText('{"a": }')
    expect('error' in r && r.error).toMatch(/^JSON: /)
  })
})

it('pairValueText: строка как есть, прочее — JSON', () => {
  expect(pairValueText({ key: 'a', value: '{{form.a}}' })).toBe('{{form.a}}')
  expect(pairValueText({ key: 'a', value: 5 })).toBe('5')
})

it('sampleFormData', () => {
  expect(sampleFormData(['name', 'phone'])).toEqual({ name: 'пример', phone: 'пример' })
})
