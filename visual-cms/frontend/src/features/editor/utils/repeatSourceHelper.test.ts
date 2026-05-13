import { describe, expect, it } from 'vitest'
import type { BlockNode } from '@/shared/types'
import type { PageVariable, PageVariablesEnvelope } from '@/shared/api'
import {
  CAROUSEL_VARIABLE_ATTR,
  getCarouselSourceStatus,
  getCarouselVariableName,
  listArrayVariables,
  makeNewArrayVariable,
  setCarouselVariableAttr,
} from './repeatSourceHelper'

const mkNode = (attrs: Record<string, string> = {}): BlockNode => ({
  id: 'n',
  tag: 'div',
  tagName: 'div',
  elementType: 'container',
  styles: { properties: {} },
  children: [],
  attributes: attrs,
  metadata: {},
})

const mkVar = (over: Partial<PageVariable> = {}): PageVariable => ({
  id: 'v-' + Math.random().toString(36).slice(2, 8),
  name: 'foo',
  type: 'array',
  defaultValue: [],
  ...over,
})

const env = (variables: PageVariable[]): PageVariablesEnvelope => ({ variables })

describe('getCarouselVariableName', () => {
  it('null когда node=null/undefined', () => {
    expect(getCarouselVariableName(null)).toBeNull()
    expect(getCarouselVariableName(undefined)).toBeNull()
  })

  it('null когда атрибут отсутствует или пустая строка', () => {
    expect(getCarouselVariableName(mkNode({}))).toBeNull()
    expect(getCarouselVariableName(mkNode({ [CAROUSEL_VARIABLE_ATTR]: '' }))).toBeNull()
  })

  it('возвращает значение атрибута', () => {
    expect(getCarouselVariableName(mkNode({ [CAROUSEL_VARIABLE_ATTR]: 'heroSlides' }))).toBe('heroSlides')
  })
})

describe('setCarouselVariableAttr', () => {
  it('добавляет атрибут не трогая остальные', () => {
    const next = setCarouselVariableAttr({ 'data-carousel': 'true', 'data-other': 'x' }, 'heroSlides')
    expect(next).toEqual({
      'data-carousel': 'true',
      'data-other': 'x',
      [CAROUSEL_VARIABLE_ATTR]: 'heroSlides',
    })
  })

  it('подменяет существующее значение', () => {
    const next = setCarouselVariableAttr({ [CAROUSEL_VARIABLE_ATTR]: 'old' }, 'new')
    expect(next[CAROUSEL_VARIABLE_ATTR]).toBe('new')
  })

  it('удаляет атрибут когда name=null/пустая/whitespace', () => {
    const base = { [CAROUSEL_VARIABLE_ATTR]: 'x', other: 'y' }
    expect(setCarouselVariableAttr(base, null)).toEqual({ other: 'y' })
    expect(setCarouselVariableAttr(base, '')).toEqual({ other: 'y' })
    expect(setCarouselVariableAttr(base, '   ')).toEqual({ other: 'y' })
  })

  it('тримит whitespace вокруг name', () => {
    const next = setCarouselVariableAttr({}, '  heroSlides  ')
    expect(next[CAROUSEL_VARIABLE_ATTR]).toBe('heroSlides')
  })

  it('не мутирует input attributes', () => {
    const input = { [CAROUSEL_VARIABLE_ATTR]: 'old' }
    setCarouselVariableAttr(input, 'new')
    expect(input[CAROUSEL_VARIABLE_ATTR]).toBe('old')
  })

  it('handles undefined input', () => {
    expect(setCarouselVariableAttr(undefined, 'foo')).toEqual({ [CAROUSEL_VARIABLE_ATTR]: 'foo' })
  })
})

describe('listArrayVariables', () => {
  it('пустой массив для null/undefined envelope', () => {
    expect(listArrayVariables(null)).toEqual([])
    expect(listArrayVariables(undefined)).toEqual([])
    expect(listArrayVariables({ variables: [] })).toEqual([])
  })

  it('фильтрует только type=array', () => {
    const a = mkVar({ name: 'a', type: 'array' })
    const b = mkVar({ name: 'b', type: 'string' })
    const c = mkVar({ name: 'c', type: 'array' })
    const d = mkVar({ name: 'd', type: 'object' })
    const result = listArrayVariables(env([a, b, c, d]))
    expect(result.map(v => v.name)).toEqual(['a', 'c'])
  })
})

describe('getCarouselSourceStatus', () => {
  const heroSlides = mkVar({ name: 'heroSlides', type: 'array' })

  it("'unset' когда атрибут пуст", () => {
    expect(getCarouselSourceStatus(mkNode({}), env([heroSlides]))).toBe('unset')
    expect(getCarouselSourceStatus(null, env([heroSlides]))).toBe('unset')
  })

  it("'orphan' когда переменной с таким name нет", () => {
    const node = mkNode({ [CAROUSEL_VARIABLE_ATTR]: 'missingVar' })
    expect(getCarouselSourceStatus(node, env([heroSlides]))).toBe('orphan')
    expect(getCarouselSourceStatus(node, null)).toBe('orphan')
    expect(getCarouselSourceStatus(node, { variables: [] })).toBe('orphan')
  })

  it("'wrong-type' если переменная есть, но не array", () => {
    const stringVar = mkVar({ name: 'someName', type: 'string' })
    const node = mkNode({ [CAROUSEL_VARIABLE_ATTR]: 'someName' })
    expect(getCarouselSourceStatus(node, env([stringVar]))).toBe('wrong-type')
  })

  it("'ok' для существующей array-переменной", () => {
    const node = mkNode({ [CAROUSEL_VARIABLE_ATTR]: 'heroSlides' })
    expect(getCarouselSourceStatus(node, env([heroSlides]))).toBe('ok')
  })
})

describe('makeNewArrayVariable', () => {
  let counter = 0
  const genId = () => `id-${++counter}`

  it('создаёт array-переменную с пустым defaultValue', () => {
    counter = 0
    const v = makeNewArrayVariable(env([]), 'mySlides', genId)
    expect(v).toMatchObject({
      id: 'id-1',
      name: 'mySlides',
      type: 'array',
      defaultValue: [],
    })
  })

  it('добавляет суффикс _2, _3 при коллизии имени', () => {
    counter = 0
    const taken = env([
      mkVar({ name: 'mySlides' }),
      mkVar({ name: 'mySlides_2' }),
    ])
    const v = makeNewArrayVariable(taken, 'mySlides', genId)
    expect(v.name).toBe('mySlides_3')
  })

  it('fallback name="newCarouselSource" при пустой строке', () => {
    counter = 0
    const v = makeNewArrayVariable(env([]), '   ', genId)
    expect(v.name).toBe('newCarouselSource')
  })

  it('тримит preferredName', () => {
    counter = 0
    const v = makeNewArrayVariable(env([]), '  trimMe  ', genId)
    expect(v.name).toBe('trimMe')
  })
})
