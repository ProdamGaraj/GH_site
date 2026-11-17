/**
 * Рантайм заявок вставляется в каждую страницу; в превью (нет analyticsPageId)
 * он в режиме «не отправлять».
 */
import { htmlGenerator, GeneratePageOptions } from '../services/HtmlGenerator'
import type { BlockNode } from '../types/blockNode'

function page(): BlockNode {
  return {
    id: 'root',
    elementType: 'container',
    tagName: 'div',
    styles: { properties: {} },
    children: [],
    attributes: {},
    metadata: {},
  } as BlockNode
}

const baseOpts: GeneratePageOptions = { metadata: { title: 'T', description: 'D', keywords: [] }, slug: 'about' }

function config(html: string): { live: boolean; labels: { consent: string } } {
  const m = /var CONFIG = (\{.*?\});\n/.exec(html)
  if (!m) throw new Error('нет рантайма заявок')
  return JSON.parse(m[1])
}

describe('HtmlGenerator — рантайм заявок', () => {
  it('опубликованная страница: заявки отправляются, подписи языка страницы', () => {
    const html = htmlGenerator.generatePage(page(), { ...baseOpts, lang: 'uz', analyticsPageId: 'p-1' })
    expect(html).toContain('<style data-gh-leads>')
    expect(config(html).live).toBe(true)
    expect(config(html).labels.consent).toContain('rozilik')
  })

  it('превью: рантайм есть (видна строка согласия), но не отправляет', () => {
    expect(config(htmlGenerator.generatePage(page(), baseOpts)).live).toBe(false)
  })

  it('ровно один экземпляр и до Site JS', () => {
    const html = htmlGenerator.generatePage(page(), { ...baseOpts, analyticsPageId: 'p-1', siteJs: 'window.__siteJs = 1' })
    expect(html.split('window.__ghLeads = true').length - 1).toBe(1)
    expect(html.indexOf('window.__ghLeads = true')).toBeLessThan(html.indexOf('window.__siteJs = 1'))
  })
})
