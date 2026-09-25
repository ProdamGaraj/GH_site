/**
 * Рантайм карты проекта: когда генератор вставляет его в страницу.
 * Поведение самого рантайма — в MapRuntime.runtime.test.ts.
 */
import * as fs from 'fs'
import * as path from 'path'
import { generateMapRuntime, hasProjectMap } from '../services/MapRuntime'
import { htmlGenerator, GeneratePageOptions } from '../services/HtmlGenerator'
import type { BlockNode } from '../types/blockNode'

const RUNTIME_FILE = path.join(__dirname, '..', 'services', 'runtime', 'map-runtime.js')

function node(attributes: Record<string, string>): BlockNode {
  return {
    id: 'root',
    elementType: 'container',
    tagName: 'div',
    styles: { properties: {} },
    children: [],
    attributes,
    metadata: {},
  } as BlockNode
}

const opts: GeneratePageOptions = {
  metadata: { title: 'T', description: 'D', keywords: [] },
  slug: 'complex/dostlik',
}

describe('hasProjectMap', () => {
  it('корень карты — атрибут data-map в любом написании', () => {
    expect(hasProjectMap('<div data-map="">')).toBe(true)
    expect(hasProjectMap('<div class="project-map" data-map>')).toBe(true)
    expect(hasProjectMap('<div data-map class="x">')).toBe(true)
  })

  it('соседние атрибуты карты без корня — не карта', () => {
    expect(hasProjectMap('<li data-map-point="" data-lat="41.3">')).toBe(false)
    expect(hasProjectMap('<button data-map-filter="school">')).toBe(false)
    expect(hasProjectMap('<div data-mapper="">')).toBe(false)
    expect(hasProjectMap('')).toBe(false)
  })
})

describe('generateMapRuntime', () => {
  it('без карты на странице — ничего', () => {
    expect(generateMapRuntime('<section id="location"></section>')).toBe('')
  })

  it('с картой — файл рантайма целиком внутри <script>', () => {
    const out = generateMapRuntime('<div data-map=""></div>')
    expect(out.startsWith('<script>\n')).toBe(true)
    expect(out.endsWith('\n</script>')).toBe(true)
    expect(out).toContain(fs.readFileSync(RUNTIME_FILE, 'utf8'))
  })

  it('в файле нет </script>: он закрыл бы тег раньше времени', () => {
    expect(fs.readFileSync(RUNTIME_FILE, 'utf8')).not.toMatch(/<\/script/i)
  })
})

describe('HtmlGenerator', () => {
  it('страница с картой получает рантайм, остальные — нет', () => {
    expect(htmlGenerator.generatePage(node({ 'data-map': '' }), opts)).toContain('window.ghProjectMap')
    expect(htmlGenerator.generatePage(node({ 'data-map-point': '' }), opts)).not.toContain('window.ghProjectMap')
  })
})
