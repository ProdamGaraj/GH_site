/**
 * Автоинжект аналитического трекера в сгенерированные страницы.
 *
 * Регресс-кейс: tracker.js существовал, но никто его не вставлял в деплой —
 * опубликованные сайты не слали события, страница «SEO Аналитика» была в нулях.
 * Деплой передаёт analyticsPageId (id страницы), превью — нет (не загрязняем
 * статистику).
 */
import { htmlGenerator, GeneratePageOptions } from '../services/HtmlGenerator'
import type { BlockNode } from '../types/blockNode'

const PAGE_ID = '3f2d1c4b-5a69-4e78-9b0d-112233445566'

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

const baseOpts: GeneratePageOptions = {
  metadata: { title: 'T', description: 'D', keywords: [] },
  slug: 'about',
}

describe('HtmlGenerator — инжект analytics tracker', () => {
  it('с analyticsPageId вставляет tracker.js с data-page-id', () => {
    const html = htmlGenerator.generatePage(page(), { ...baseOpts, analyticsPageId: PAGE_ID })
    expect(html).toContain(
      `<script src="/api/analytics/tracker.js" data-page-id="${PAGE_ID}" defer></script>`
    )
  })

  it('без analyticsPageId (превью) трекера нет', () => {
    const html = htmlGenerator.generatePage(page(), baseOpts)
    expect(html).not.toContain('analytics/tracker.js')
  })
})
