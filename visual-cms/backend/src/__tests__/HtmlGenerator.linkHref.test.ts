/**
 * Нормализация относительных href у <a> при генерации HTML.
 *
 * Регресс-кейс: страницы публикуются директориями /<slug>/index.html, поэтому
 * href="contacts" из шапки на странице /about/ вёл на /about/contacts вместо
 * /contacts. Внутренние относительные ссылки приводятся к корневым.
 */
import { htmlGenerator, GeneratePageOptions } from '../services/HtmlGenerator'
import type { BlockNode } from '../types/blockNode'

function linkNode(attributes: Record<string, string>): BlockNode {
  return {
    id: 'link-1',
    elementType: 'link',
    tagName: 'a',
    styles: { properties: {} },
    children: [],
    attributes,
    content: 'Контакты',
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
  slug: 'about',
}

const aTag = (html: string): string => {
  const m = html.match(/<a[^>]*>/)
  return m ? m[0] : ''
}

describe('HtmlGenerator — нормализация href у <a>', () => {
  it('относительный href получает ведущий слэш', () => {
    const html = htmlGenerator.generatePage(page([linkNode({ href: 'contacts' })]), opts)
    expect(aTag(html)).toContain('href="/contacts"')
  })

  it('"./" и "../" в начале срезаются', () => {
    expect(aTag(htmlGenerator.generatePage(page([linkNode({ href: './news' })]), opts)))
      .toContain('href="/news"')
    expect(aTag(htmlGenerator.generatePage(page([linkNode({ href: '../news/item' })]), opts)))
      .toContain('href="/news/item"')
  })

  it.each([
    ['https://example.com/x', 'href="https://example.com/x"'],
    ['//cdn.example.com/x', 'href="//cdn.example.com/x"'],
    ['mailto:a@b.com', 'href="mailto:a@b.com"'],
    ['tel:+998900000000', 'href="tel:+998900000000"'],
    ['/already-root', 'href="/already-root"'],
    ['#section', 'href="#section"'],
    ['?page=2', 'href="?page=2"'],
  ])('не трогает %s', (href, expected) => {
    const html = htmlGenerator.generatePage(page([linkNode({ href })]), opts)
    expect(aTag(html)).toContain(expected)
  })

  it('не-<a> теги не затрагиваются (относительный src у img остаётся)', () => {
    const img: BlockNode = {
      id: 'img-1',
      elementType: 'image',
      tagName: 'img',
      styles: { properties: {} },
      children: [],
      attributes: { src: 'media/x.jpg', href: 'media/x.jpg' },
      metadata: {},
    } as BlockNode
    const html = htmlGenerator.generatePage(page([img]), opts)
    expect(html).toContain('src="media/x.jpg"')
    expect(html).toContain('href="media/x.jpg"')
  })
})
