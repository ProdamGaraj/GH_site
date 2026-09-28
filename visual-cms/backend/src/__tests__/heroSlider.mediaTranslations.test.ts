/**
 * Картинки и видео слайдера главной по языкам — от перевода до HTML.
 *
 * Слайдер «Hero Slider» (fixtures/heroSliderBlock.json — копия со стенда):
 * статичная карусель, два фото-слайда (фон) и два видео-слайда
 * (data-slide-video). Языковой вариант задаётся в редакторе страницы, в
 * «Языки и экраны» у слайда, и хранится переводом страницы по id слайда:
 *   bg:image            фото для языка
 *   bg:image@<экран>    фото для языка на конкретном экране
 *   data-slide-video    видео для языка
 * Здесь те же шаги, что у деплоя языковой версии (deployPageTranslations):
 * applyTranslations → generatePage с translationMap.
 */
jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn(), find: jest.fn(), save: jest.fn(), findByIds: jest.fn(),
    }),
  },
}))

import { htmlGenerator } from '../services/HtmlGenerator'
import { applyTranslationsToTree, extractTranslatableFields, extractResponsiveMediaFields, TranslationMap } from '../services/TranslationService'
import type { BlockNode } from '../types/blockNode'

const HERO: BlockNode = require('./fixtures/heroSliderBlock.json')

const PHOTO_1 = '1782800046909-gli337mn1'
const PHOTO_2 = '1782800066134-pk2bq6rpl'
const VIDEO_1 = '1782800081162-gghx43onm'
const VIDEO_2 = '1782800088277-mlwmabe4s'

const UZ: TranslationMap = {
  [PHOTO_1]: { 'bg:image': '/media/uz-banner-1.png' },
  [PHOTO_2]: { 'bg:image@mobile': '/media/uz-banner-2-phone.png' },
  [VIDEO_1]: { 'data-slide-video': '/media/uz-video-1.mp4' },
}

function render(structure: BlockNode, lang: string, translationMap: TranslationMap = {}): string {
  return htmlGenerator.generatePage(structure, {
    metadata: { title: 'T', description: 'D', keywords: [] },
    slug: 'index',
    lang,
    translationMap,
  })
}

/** Открывающий тег слайда по его id. */
function slideTag(html: string, id: string): string {
  const match = html.match(new RegExp(`<div[^>]*data-element-id="${id}"[^>]*>`))
  if (!match) throw new Error(`нет слайда ${id}`)
  return match[0]
}

describe('слайдер главной: медиа по языкам', () => {
  it('в панель переводов попадают фон каждого фото-слайда и видео каждого видео-слайда', () => {
    const fields = extractTranslatableFields(HERO).map((e) => `${e.nodeId} ${e.field}`)
    expect(fields).toEqual(
      expect.arrayContaining([
        `${PHOTO_1} bg:image`,
        `${PHOTO_2} bg:image`,
        `${VIDEO_1} data-slide-video`,
        `${VIDEO_2} data-slide-video`,
      ])
    )
  })

  it('/uz/: фото и видео заменены своими вариантами, остальные слайды — как на ru', () => {
    const { structure } = applyTranslationsToTree(HERO, UZ)
    const html = render(structure, 'uz', UZ)

    expect(slideTag(html, PHOTO_1)).toContain('background-image: url(&quot;/media/uz-banner-1.png&quot;)')
    expect(slideTag(html, VIDEO_1)).toContain('data-slide-video="/media/uz-video-1.mp4"')
    // Без варианта — исходные файлы.
    expect(slideTag(html, PHOTO_2)).toContain('/media/968e5407-9af7-47ea-a05f-742d19397f5b.png')
    expect(slideTag(html, VIDEO_2)).toContain('data-slide-video="/media/610d479b-8c47-4a10-98e8-669ecb63d705.mp4"')
  })

  it('/uz/: фото для телефона — отдельным правилом @media, на компьютере остаётся общее', () => {
    const { structure } = applyTranslationsToTree(HERO, UZ)
    const html = render(structure, 'uz', UZ)
    const rule = `[data-element-id="${PHOTO_2}"] { background-image: url("/media/uz-banner-2-phone.png") !important; }`
    expect(html).toContain(rule)
    const media = html.slice(0, html.indexOf(rule)).lastIndexOf('@media')
    expect(html.slice(media, html.indexOf(rule))).toMatch(/@media \(max-width: \d+px\)/)
  })

  it('ru не задет: исходные файлы и никаких языковых правил', () => {
    const html = render(HERO, 'ru')
    expect(html).not.toContain('uz-banner')
    expect(html).not.toContain('uz-video')
    expect(slideTag(html, PHOTO_1)).toContain('/media/58f397f3-bca6-42ec-8465-0d89e40f4c03.png')
  })

  it('вариант экрана без языка у слайдов не заведён — панели переводов нечего показывать сверх базы', () => {
    expect(extractResponsiveMediaFields(HERO)).toEqual([])
  })
})
