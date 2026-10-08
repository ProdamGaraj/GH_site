/**
 * Секция-блок новости: шаблон «Новость» → данные элемента (DTO news-service:
 * section.block = [{ blockId, valuesJson }]) → разворот блока данных из
 * библиотеки с подстановкой значений якорей → HTML.
 */
const BLOCK_ID = '55555555-5555-4555-8555-555555555555'

jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => ({
      find: jest.fn(async ({ where }: any) => (where?.id?.value ?? []).includes(BLOCK_ID) ? [dataBlock] : []),
      findOne: jest.fn(),
      save: jest.fn(),
    })),
  },
}))
jest.mock('../services/LanguageService', () => ({
  languageService: { getActive: jest.fn(async () => [{ code: 'ru', isDefault: true, isActive: true }, { code: 'uz', isDefault: false, isActive: true }]) },
}))
jest.mock('../services/TranslationService', () => {
  const actual = jest.requireActual('../services/TranslationService')
  return {
    ...actual,
    // Статика блока (подпись «Акция») переведена у блока; якоря — из данных новости.
    translationService: { getBlockTreeTranslationMap: jest.fn(async (_b: string, _t: unknown, l: string) => (l === 'uz' ? { 'promo-label': { content: 'Aksiya' } } : {})) },
  }
})

import { applyAnchors, type AnchorNode } from '../services/dataAnchors'
import { deployService } from '../services/DeployService'
import { htmlGenerator } from '../services/HtmlGenerator'
import { addBlockSectionVariant, buildNewsTemplate, brokenRepeats, NEWS_BLOCK_VARIANT_ID } from '../scripts/newsTemplate'
import type { StructureNode } from '../scripts/choiceToPlanTypes'

const source: AnchorNode = {
  id: 'promo-root',
  tagName: 'section',
  elementType: 'container',
  metadata: { globalCss: '.promo-card{border-radius:24px}' },
  children: [
    { id: 'promo-label', tagName: 'span', elementType: 'text', content: 'Акция' },
    { id: 'promo-title', tagName: 'h2', elementType: 'text', content: 'Рассрочка 0%' },
    { id: 'promo-body', tagName: 'p', elementType: 'text', content: 'Текст акции' },
    { id: 'promo-photo', tagName: 'img', elementType: 'image', attributes: { src: '/media/old.jpg' } },
    { id: 'promo-cta', tagName: 'a', elementType: 'text', content: 'Оставить заявку', attributes: { href: '/old' } },
  ],
}
const dataBlock = {
  id: BLOCK_ID,
  name: 'Promo (данные)',
  structure: applyAnchors(source, [
    { nodeId: 'promo-title', kind: 'text', label: 'title' },
    { nodeId: 'promo-body', kind: 'richtext', label: 'body' },
    { nodeId: 'promo-photo', kind: 'image', label: 'photo' },
    { nodeId: 'promo-cta', kind: 'link', label: 'cta' },
  ]).structure,
}

const node = (id: string): StructureNode => ({ id, tagName: 'div', elementType: 'container', children: [], metadata: { linkedBlockId: `${id}-block` } })
const TEMPLATE = buildNewsTemplate({ navigation: node('nav'), footer: node('footer'), breakpoints: [] })
const svc = deployService as any

const values = (lang: 'ru' | 'uz') =>
  lang === 'ru'
    ? { title: 'Ипотека <12%>', body: '<p>Без <strong>переплат</strong></p>', photo: '/media/new.jpg', cta: { href: '/apply', text: 'Подать заявку' } }
    : { title: 'Ipoteka <12%>', body: '<p>Ortiqcha <strong>toʼlovsiz</strong></p>', photo: '/media/new.jpg', cta: { href: '/apply', text: 'Ariza berish' } }

const item = (lang: 'ru' | 'uz') => ({
  title: 'Новость',
  hero: [],
  category: [],
  sections: [
    { id: 's1', text: [{ html: '<p>Вступление</p>' }], photoText: [], sliderText: [], block: [] },
    { id: 's2', text: [], photoText: [], sliderText: [], block: [{ blockId: BLOCK_ID, valuesJson: JSON.stringify(values(lang)) }] },
  ],
})

async function renderBody(lang: 'ru' | 'uz'): Promise<string> {
  const structure = await svc.expandDataSlideBlocks(svc.substituteItemData(TEMPLATE, item(lang)), lang)
  const html = htmlGenerator.generatePage(structure, { metadata: { title: 't', description: '', keywords: [] }, slug: 'news/x' })
  return html
}

describe('шаблон: заготовка секции-блока', () => {
  it('в новом шаблоне есть, повторы целы', () => {
    expect(JSON.stringify(TEMPLATE)).toContain(NEWS_BLOCK_VARIANT_ID)
    expect(brokenRepeats(TEMPLATE)).toEqual([])
  })

  it('старый шаблон (до секций-блоков) получает заготовку; повторно — без правок', () => {
    const old = JSON.parse(JSON.stringify(TEMPLATE))
    const strip = (n: StructureNode) => {
      n.children = (n.children ?? []).filter((c) => c.id !== NEWS_BLOCK_VARIANT_ID)
      n.children.forEach(strip)
    }
    strip(old)
    expect(JSON.stringify(old)).not.toContain(NEWS_BLOCK_VARIANT_ID)
    const up = addBlockSectionVariant(old)
    expect(up.changed).toBe(true)
    expect(JSON.stringify(up.structure)).toContain(NEWS_BLOCK_VARIANT_ID)
    expect(addBlockSectionVariant(up.structure).changed).toBe(false)
  })
})

describe('страница новости с секцией-блоком', () => {
  it('ru: блок внутри секции, якоря — значения новости; текст экранирован, HTML — как есть', async () => {
    const html = await renderBody('ru')
    expect(html).toContain('class="news-section news-section--block"')
    expect(html).toContain('Ипотека &lt;12%&gt;')
    expect(html).toContain('<p>Без <strong>переплат</strong></p>')
    expect(html).toMatch(/<img[^>]*src="\/media\/new\.jpg"/)
    expect(html).toMatch(/<a[^>]*href="\/apply"[^>]*>Подать заявку<\/a>/)
    expect(html).toContain('Акция')
    expect(html).toContain('.promo-card{border-radius:24px}')
  })

  it('плейсхолдеров и служебного атрибута со значениями в HTML нет', async () => {
    const html = await renderBody('ru')
    expect(html).not.toContain('{{$.')
    expect(html).not.toContain('data-block-values')
    expect(html).not.toContain('/media/old.jpg')
  })

  it('uz: значения — перевод новости, статика блока — перевод блока', async () => {
    const html = await renderBody('uz')
    expect(html).toContain('Ipoteka &lt;12%&gt;')
    expect(html).toContain('Ariza berish')
    expect(html).toContain('Aksiya')
    expect(html).not.toContain('>Акция<')
  })

  it('обычные секции рядом рисуются как раньше', async () => {
    expect(await renderBody('ru')).toContain('<p>Вступление</p>')
  })
})
