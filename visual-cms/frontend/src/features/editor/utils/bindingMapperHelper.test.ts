import { describe, expect, it } from 'vitest'
import {
  inferInputKind,
  humanizeLabel,
  getMapperSchema,
  findRepeaterBinding,
  readSlideValue,
  writeSlideValue,
  isSlideFieldVisible,
  getHiddenSlideFields,
  setSlideFieldVisible,
} from './bindingMapperHelper'
import type { DataBinding, FieldMapping } from '@/shared/types/dataBinding'

const fm = (sourceField: string, targetProperty: string): FieldMapping => ({
  id: 'fm-' + sourceField,
  sourceField,
  targetProperty,
})

describe('inferInputKind', () => {
  it('media: backgroundImage', () => {
    expect(inferInputKind('self.style.backgroundImage')).toBe('media')
  })
  it('media: .attr.src', () => {
    expect(inferInputKind('[data-bind=img].attr.src')).toBe('media')
  })
  it('media: .src', () => {
    expect(inferInputKind('self.src')).toBe('media')
  })
  it('url: .attr.href', () => {
    expect(inferInputKind('[data-bind=cta].attr.href')).toBe('url')
  })
  it('url: .href', () => {
    expect(inferInputKind('self.href')).toBe('url')
  })
  it('text: .textContent', () => {
    expect(inferInputKind('[data-bind=title].textContent')).toBe('text')
  })
  it('text: произвольный attr', () => {
    expect(inferInputKind('[data-bind=x].attr.title')).toBe('text')
  })
  it('text: пусто/null/undefined', () => {
    expect(inferInputKind('')).toBe('text')
    expect(inferInputKind(null)).toBe('text')
    expect(inferInputKind(undefined)).toBe('text')
  })
})

describe('humanizeLabel', () => {
  it('camelCase → Title Case', () => {
    expect(humanizeLabel('ctaHref')).toBe('Cta Href')
    expect(humanizeLabel('description')).toBe('Description')
    expect(humanizeLabel('title')).toBe('Title')
  })
  it('пустая строка', () => {
    expect(humanizeLabel('')).toBe('')
  })
})

describe('getMapperSchema', () => {
  it('пустые/null входы → []', () => {
    expect(getMapperSchema(null)).toEqual([])
    expect(getMapperSchema(undefined)).toEqual([])
    expect(getMapperSchema([])).toEqual([])
  })
  it('hero-like fieldMappings → корректная схема', () => {
    const schema = getMapperSchema([
      fm('image', 'self.style.backgroundImage'),
      fm('title', '[data-bind=title].textContent'),
      fm('ctaText', '[data-bind=cta].textContent'),
      fm('ctaHref', '[data-bind=cta].attr.href'),
    ])
    expect(schema).toHaveLength(4)
    expect(schema[0]).toMatchObject({ sourceField: 'image', kind: 'media' })
    expect(schema[1]).toMatchObject({ sourceField: 'title', kind: 'text' })
    expect(schema[2]).toMatchObject({ sourceField: 'ctaText', kind: 'text' })
    expect(schema[3]).toMatchObject({ sourceField: 'ctaHref', kind: 'url' })
  })
  it('сохраняет порядок', () => {
    const schema = getMapperSchema([fm('z', '.text'), fm('a', '.text'), fm('m', '.text')])
    expect(schema.map(s => s.sourceField)).toEqual(['z', 'a', 'm'])
  })
  it('дедуп по sourceField — оставляет первый', () => {
    const schema = getMapperSchema([
      fm('title', '[data-bind=title].textContent'),
      fm('title', 'self.style.backgroundImage'), // дубль — игнор
    ])
    expect(schema).toHaveLength(1)
    expect(schema[0].kind).toBe('text')
  })
  it('игнорирует служебные поля (_id, _imageAssetId)', () => {
    const schema = getMapperSchema([fm('_id', '.x'), fm('_imageAssetId', '.x'), fm('title', '.text')])
    expect(schema).toHaveLength(1)
    expect(schema[0].sourceField).toBe('title')
  })
  it('игнорирует alignment (per-slide UI)', () => {
    const schema = getMapperSchema([fm('alignment', '.x'), fm('title', '.text')])
    expect(schema).toHaveLength(1)
    expect(schema[0].sourceField).toBe('title')
  })
  it('игнорирует пустые/мусорные элементы', () => {
    const schema = getMapperSchema([
      // @ts-expect-error — намеренно проверяем устойчивость
      null,
      // @ts-expect-error
      { sourceField: '', targetProperty: '.x' },
      fm('title', '.text'),
    ])
    expect(schema).toHaveLength(1)
  })
  it('label генерится правильно', () => {
    const schema = getMapperSchema([fm('ctaHref', '[data-bind=cta].attr.href')])
    expect(schema[0].label).toBe('Cta Href')
  })
})

const mkBinding = (overrides: Partial<DataBinding>): DataBinding =>
  ({
    id: 'b1',
    blockId: 'track-1',
    pageId: 'page-1',
    dataSourceId: 'ds-1',
    bindingType: 'input',
    isActive: true,
    priority: 0,
    config: { inputConfig: { mode: 'repeater', fieldMappings: [] } },
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }) as DataBinding

describe('findRepeaterBinding', () => {
  it('возвращает подходящий binding', () => {
    const bindings = [mkBinding({})]
    expect(findRepeaterBinding(bindings, 'track-1', 'page-1')?.id).toBe('b1')
  })
  it('null/empty входы → null', () => {
    expect(findRepeaterBinding(null, 'track-1')).toBeNull()
    expect(findRepeaterBinding([], 'track-1')).toBeNull()
    expect(findRepeaterBinding([mkBinding({})], '')).toBeNull()
  })
  it('игнорирует output bindings', () => {
    expect(findRepeaterBinding([mkBinding({ bindingType: 'output' })], 'track-1')).toBeNull()
  })
  it('игнорирует isActive=false', () => {
    expect(findRepeaterBinding([mkBinding({ isActive: false })], 'track-1')).toBeNull()
  })
  it('игнорирует mode != repeater', () => {
    const b = mkBinding({ config: { inputConfig: { mode: 'single', fieldMappings: [] } } })
    expect(findRepeaterBinding([b], 'track-1')).toBeNull()
  })
  it('strict pageId match если binding имеет pageId', () => {
    expect(findRepeaterBinding([mkBinding({ pageId: 'other' })], 'track-1', 'page-1')).toBeNull()
  })
  it('global binding (pageId=null) подходит любой странице', () => {
    expect(findRepeaterBinding([mkBinding({ pageId: null })], 'track-1', 'page-1')?.id).toBe('b1')
  })
})

describe('readSlideValue', () => {
  it('возвращает строку как есть', () => {
    expect(readSlideValue({ title: 'hello' }, 'title')).toBe('hello')
  })
  it('missing/null → ""', () => {
    expect(readSlideValue({}, 'title')).toBe('')
    expect(readSlideValue(null, 'title')).toBe('')
    expect(readSlideValue({ title: null }, 'title')).toBe('')
  })
  it('число конвертится в строку', () => {
    expect(readSlideValue({ count: 42 }, 'count')).toBe('42')
  })
})

describe('writeSlideValue', () => {
  it('иммутабельно записывает', () => {
    const orig = { title: 'a', other: 1 }
    const next = writeSlideValue(orig, 'title', 'b')
    expect(next).toEqual({ title: 'b', other: 1 })
    expect(orig.title).toBe('a')
    expect(next).not.toBe(orig)
  })
  it('создаёт новый объект из null', () => {
    expect(writeSlideValue(null, 'title', 'x')).toEqual({ title: 'x' })
  })
})

describe('видимость блоков слайда', () => {
  it('isSlideFieldVisible: по умолчанию всё видно (нет _hidden)', () => {
    expect(isSlideFieldVisible({}, 'title')).toBe(true)
    expect(isSlideFieldVisible({ title: 'a' }, 'title')).toBe(true)
    expect(isSlideFieldVisible(null, 'title')).toBe(true)
  })

  it('isSlideFieldVisible: поле в _hidden → невидимо', () => {
    expect(isSlideFieldVisible({ _hidden: ['ctaText'] }, 'ctaText')).toBe(false)
    expect(isSlideFieldVisible({ _hidden: ['ctaText'] }, 'title')).toBe(true)
  })

  it('getHiddenSlideFields: множество скрытых; мусор отфильтрован', () => {
    expect(getHiddenSlideFields({ _hidden: ['a', 'b'] })).toEqual(new Set(['a', 'b']))
    expect(getHiddenSlideFields({})).toEqual(new Set())
    // устойчивость к не-массиву
    expect(getHiddenSlideFields({ _hidden: 'x' })).toEqual(new Set())
    expect(getHiddenSlideFields({ _hidden: ['a', 1, null] as unknown[] })).toEqual(new Set(['a']))
  })

  it('setSlideFieldVisible: скрыть добавляет в _hidden (иммутабельно)', () => {
    const orig = { title: 'a' }
    const next = setSlideFieldVisible(orig, 'title', false)
    expect(next._hidden).toEqual(['title'])
    expect(orig).not.toHaveProperty('_hidden') // оригинал не мутирован
  })

  it('setSlideFieldVisible: показать удаляет из _hidden; пустой список — убирает ключ', () => {
    const next = setSlideFieldVisible({ _hidden: ['title'] }, 'title', true)
    expect(next).not.toHaveProperty('_hidden')
  })

  it('setSlideFieldVisible: показать оставляет другие скрытые', () => {
    const next = setSlideFieldVisible({ _hidden: ['title', 'image'] }, 'title', true)
    expect(next._hidden).toEqual(['image'])
  })

  it('setSlideFieldVisible: скрыть не дублирует уже скрытое', () => {
    const next = setSlideFieldVisible({ _hidden: ['title'] }, 'title', false)
    expect(next._hidden).toEqual(['title'])
  })

  it('setSlideFieldVisible: round-trip через isSlideFieldVisible', () => {
    let s: Record<string, unknown> = { ctaText: 'go' }
    s = setSlideFieldVisible(s, 'ctaText', false)
    expect(isSlideFieldVisible(s, 'ctaText')).toBe(false)
    s = setSlideFieldVisible(s, 'ctaText', true)
    expect(isSlideFieldVisible(s, 'ctaText')).toBe(true)
  })
})
