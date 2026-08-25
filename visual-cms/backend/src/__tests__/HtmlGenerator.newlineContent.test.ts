/**
 * Переносы строк в текстовом контенте: если content содержит \n, генератор
 * включает white-space:pre-wrap (иначе браузер схлопывает переносы в пробел).
 * Паритет с редактором (CanvasRenderer). pre/textarea не трогаем (сохраняют \n
 * нативно), явно заданный white-space пользователя не переопределяем.
 */
import { htmlGenerator, GeneratePageOptions } from '../services/HtmlGenerator'
import type { BlockNode } from '../types/blockNode'

function textNode(
  content: string,
  tagName = 'p',
  properties: Record<string, unknown> = {}
): BlockNode {
  return {
    id: 'txt-1',
    elementType: 'text',
    tagName,
    styles: { properties },
    children: [],
    attributes: {},
    content,
    metadata: {},
  } as BlockNode
}

function page(children: BlockNode[]): BlockNode {
  return {
    id: 'root',
    elementType: 'container',
    tagName: 'div',
    styles: { properties: {} },
    children,
    attributes: {},
    metadata: {},
  } as BlockNode
}

const opts: GeneratePageOptions = {
  metadata: { title: 'T', description: 'D', keywords: [] },
  slug: 'page',
}

const tag = (html: string, name: string): string => {
  const m = html.match(new RegExp(`<${name}[^>]*>`))
  return m ? m[0] : ''
}

describe('HtmlGenerator — переносы строк в контенте', () => {
  it('content с \\n → white-space:pre-wrap и сам перенос сохранён', () => {
    const html = htmlGenerator.generatePage(page([textNode('Строка 1\nСтрока 2')]), opts)
    expect(tag(html, 'p')).toContain('white-space: pre-wrap')
    expect(html).toContain('Строка 1\nСтрока 2')
  })

  it('content без \\n → white-space не добавляется', () => {
    const html = htmlGenerator.generatePage(page([textNode('Одна строка')]), opts)
    expect(tag(html, 'p')).not.toContain('white-space')
  })

  it('pre/textarea с \\n → pre-wrap НЕ добавляется (нативно сохраняют)', () => {
    const pre = htmlGenerator.generatePage(page([textNode('a\nb', 'pre')]), opts)
    expect(tag(pre, 'pre')).not.toContain('white-space: pre-wrap')
  })

  it('явно заданный white-space пользователя не переопределяется', () => {
    const html = htmlGenerator.generatePage(
      page([textNode('a\nb', 'p', { whiteSpace: 'nowrap' })]),
      opts
    )
    const p = tag(html, 'p')
    expect(p).toContain('white-space: nowrap')
    expect(p).not.toContain('pre-wrap')
  })
})
