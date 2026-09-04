/**
 * Подстановка данных элемента коллекции в шаблон: форма {{$}} для массивов
 * примитивов.
 *
 * До неё _repeat умел разворачивать только массивы объектов ({{$.field}}),
 * а галереи, слайды героя, чипсы двора и бейджи квартир в estate-service —
 * это string[]. Их приходилось привязывать по индексу ({{item.heroImages.0}}),
 * то есть размножить было нельзя вовсе.
 *
 * Методы приватные — дёргаем через `as any`. БД мокаем: подстановка чистая.
 */
jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn(), find: jest.fn(), save: jest.fn(), findByIds: jest.fn(),
    }),
  },
}))

import { deployService } from '../services/DeployService'

const svc = deployService as any
const substitute = (structure: unknown, item: unknown) => svc.substituteItemData(structure, item)

/** Узел-повторитель: первый ребёнок — шаблон копии. */
const repeater = (source: string, template: unknown, extra: Record<string, unknown> = {}) => ({
  id: 'rep', tagName: 'div', children: [template], _repeat: { source, ...extra },
})
const text = (content: string, attributes: Record<string, string> = {}) => ({
  id: 'tpl', tagName: 'span', content, attributes,
})

describe('{{$}} — массивы строк', () => {
  it('разворачивает string[] в несколько узлов', () => {
    const out = substitute(repeater('item.yardFeatures', text('{{$}}')), {
      yardFeatures: ['BBQ-зона', 'Kids Room', 'Фитнес-зал'],
    })
    expect(out.children.map((c: any) => c.content)).toEqual(['BBQ-зона', 'Kids Room', 'Фитнес-зал'])
  })

  it('работает внутри значения атрибута, а не только целиком', () => {
    const out = substitute(
      repeater('item.heroImages', text('', { style: 'background-image:url("{{$}}")' })),
      { heroImages: ['/media/a.jpg', '/media/b.jpg'] }
    )
    expect(out.children.map((c: any) => c.attributes.style)).toEqual([
      'background-image:url("/media/a.jpg")',
      'background-image:url("/media/b.jpg")',
    ])
  })

  it('подставляет числа массива', () => {
    const out = substitute(repeater('item.floors', text('Этаж {{$}}')), { floors: [9, 16] })
    expect(out.children.map((c: any) => c.content)).toEqual(['Этаж 9', 'Этаж 16'])
  })

  it('уважает offset и limit', () => {
    const out = substitute(
      repeater('item.gallery', text('{{$}}'), { offset: 1, limit: 2 }),
      { gallery: ['a', 'b', 'c', 'd'] }
    )
    expect(out.children.map((c: any) => c.content)).toEqual(['b', 'c'])
  })

  it('пустой массив — ни одного узла', () => {
    const out = substitute(repeater('item.yardFeatures', text('{{$}}')), { yardFeatures: [] })
    expect(out.children).toEqual([])
  })

  it('поле не массив — ни одного узла, а не строка "undefined"', () => {
    const out = substitute(repeater('item.nope', text('{{$}}')), { nope: 'строка' })
    expect(out.children).toEqual([])
  })
})

describe('{{$}} вне повторителя', () => {
  it('на верхнем уровне $ — это сам item (объект), подставляется пустотой', () => {
    const out = substitute(text('[{{$}}]'), { name: 'Harizma' })
    expect(out.content).toBe('[]')
  })
})

describe('совместимость со старыми формами', () => {
  it('{{$.field}} по массиву объектов не сломан', () => {
    const out = substitute(repeater('item.stats', text('{{$.value}} / {{$.label}}')), {
      stats: [{ value: '16', label: 'Этажей' }, { value: '3 м', label: 'Потолки' }],
    })
    expect(out.children.map((c: any) => c.content)).toEqual(['16 / Этажей', '3 м / Потолки'])
  })

  it('{{item.field}} внутри копии по-прежнему смотрит на элемент коллекции', () => {
    const out = substitute(repeater('item.apartments', text('{{item.name}}: {{$.title}}')), {
      name: 'Harizma',
      apartments: [{ title: '1-комн.' }, { title: '2-комн.' }],
    })
    expect(out.children.map((c: any) => c.content)).toEqual(['Harizma: 1-комн.', 'Harizma: 2-комн.'])
  })

  it('индексная привязка {{item.heroImages.0}} продолжает работать', () => {
    const out = substitute(text('{{item.heroImages.0}}'), { heroImages: ['/media/a.jpg', '/media/b.jpg'] })
    expect(out.content).toBe('/media/a.jpg')
  })

  it('промах поля по-прежнему даёт пустую строку', () => {
    expect(substitute(text('[{{item.missing}}]'), {}).content).toBe('[]')
  })
})

describe('{{item}} без пути', () => {
  it('остаётся в вёрстке как есть — опечатку видно, а не молча пусто', () => {
    expect(substitute(text('{{item}}'), { name: 'X' }).content).toBe('{{item}}')
  })
})

describe('вложенные повторители', () => {
  it('внутренний {{$}} берёт элемент своего массива, item остаётся доступен', () => {
    const inner = repeater('$.badges', { id: 'b', tagName: 'span', content: '{{$}}' })
    const card = { id: 'card', tagName: 'article', children: [{ id: 'h', tagName: 'h3', content: '{{$.title}} — {{item.name}}' }, inner] }
    const out = substitute(repeater('item.apartments', card), {
      name: 'Harizma',
      apartments: [{ title: '1-комн.', badges: ['Акция', 'Ипотека'] }],
    })
    const rendered = out.children[0]
    expect(rendered.children[0].content).toBe('1-комн. — Harizma')
    expect(rendered.children[1].children.map((c: any) => c.content)).toEqual(['Акция', 'Ипотека'])
  })
})
