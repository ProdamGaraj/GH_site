/**
 * Карта проекта в блоке «Complex location»: преобразование живого блока
 * (fixtures/locationBlock.json — копия со стенда) и результат против
 * настоящего движка подстановки и генератора страницы.
 *
 * Методы подстановки приватные — дёргаем через `as any`. БД мокаем.
 */
jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn(), find: jest.fn(), save: jest.fn(), findByIds: jest.fn(),
    }),
  },
}))

import { deployService } from '../services/DeployService'
import { htmlGenerator } from '../services/HtmlGenerator'
import { MigrationError, StructureNode, findAll, incompleteNodes } from '../scripts/choiceToPlanTypes'
import {
  MAP_IMAGE_CLASS,
  PROJECT_MAP_CSS,
  PROJECT_MAP_CSS_MARKER,
  migrateLocationBlock,
} from '../scripts/projectMapBlock'
import type { BlockNode } from '../types/blockNode'

const BLOCK: StructureNode = require('./fixtures/locationBlock.json')

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const bySource = (root: StructureNode, source: string) => findAll(root, (n) => n._repeat?.source === source)
const byId = (root: StructureNode, id: string) => findAll(root, (n) => n.id === id)[0]
const substitute = (structure: unknown, item: unknown) => (deployService as any).substituteItemData(structure, item)

/** DTO проекта в той форме, в какой его отдаёт estate-service. */
const ITEM = {
  slug: 'assalom-dostlik',
  locationTitle: 'Территория большой жизни',
  locationText: 'Рядом парк и школы.',
  mapImages: [],
  locationLabels: [{ label: 'Golden House', className: 'map-label accent', top: '46%', left: '58%' }],
  mapHouse: [{ name: 'Doʼstlik', lat: 41.3, lng: 69.28 }],
  mapPoints: [
    { id: 'house', kind: 'house', type: '', name: 'Doʼstlik', lat: 41.3, lng: 69.28, color: '', distance: '' },
    { id: 'office', kind: 'office', type: '', name: 'Отдел продаж', lat: 41.3, lng: 69.29, color: '', distance: '≈ 840 м' },
    { id: 'p1', kind: 'place', type: 'school', name: 'Школа №1', lat: 41.301, lng: 69.28, color: '#2f6fdf', distance: '≈ 110 м' },
  ],
  mapLegend: [{ type: 'school', name: 'Школы', color: '#2f6fdf', icon: '<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>', count: 1 }],
  mapOffices: [{ name: 'Отдел продаж', address: 'ул. Навои, 1', lat: 41.3, lng: 69.29 }],
}

const NO_MAP = { ...ITEM, mapHouse: [], mapPoints: [], mapLegend: [], mapOffices: [] }

function render(item: unknown): string {
  const { structure } = migrateLocationBlock(BLOCK)
  return htmlGenerator.generatePage(substitute(structure, item) as BlockNode, {
    metadata: { title: 'T', description: 'D', keywords: [] },
    slug: 'complex/assalom-dostlik',
  })
}

describe('migrateLocationBlock — структура', () => {
  const { structure, changes, alreadyMigrated } = migrateLocationBlock(BLOCK)

  it('живой блок переводится целиком', () => {
    expect(alreadyMigrated).toBe(false)
    expect(changes).toEqual([
      'Локация: метки-заглушки в процентах (item.locationLabels) убраны',
      `Локация: картинке карты добавлен класс ${MAP_IMAGE_CLASS}`,
      'Локация: добавлена карта проекта (mapHouse, mapPoints, mapLegend)',
      'Локация: ссылка «Посмотреть на карте» (вела на эту же секцию) убрана',
      'Локация: кнопки такси и маршрутов до отдела продаж (mapOffices)',
      'Локация: CSS карты проекта',
    ])
  })

  it('метки в процентах и ссылка на эту же секцию убраны; панорама осталась', () => {
    expect(bySource(structure, 'item.locationLabels')).toHaveLength(0)
    expect(findAll(structure, (n) => n.attributes?.id === 'mapLink')).toHaveLength(0)
    expect(findAll(structure, (n) => n.attributes?.id === 'panoramaLink')).toHaveLength(1)
  })

  it('картинка карты осталась и помечена классом для CSS', () => {
    const [images] = bySource(structure, 'item.mapImages')
    expect(images.children![0].attributes!.class).toBe(MAP_IMAGE_CLASS)
    expect(images.children![0].styles!.properties!.backgroundImage).toBe('url("{{$.image}}")')
  })

  it('карта повторяется по mapHouse внутри рамки, после картинки', () => {
    const visual = findAll(structure, (n) => n.attributes?.id === 'locationVisual')[0]
    expect(visual.children!.map((c) => c._repeat?.source)).toEqual(['item.mapImages', 'item.mapHouse'])
    const map = visual.children![1].children![0]
    expect(map.attributes).toEqual({ class: 'project-map', 'data-map': '' })
    expect(map.children!.map((c) => c.attributes!.class)).toEqual(['project-map-canvas', 'project-map-legend', 'project-map-points'])
  })

  it('кнопки поездки повторяются по mapOffices в .location-actions', () => {
    const [trip] = bySource(structure, 'item.mapOffices')
    const links = trip.children![0].children!.filter((c) => c.tagName === 'a')
    expect(links.map((a) => a.content)).toEqual(['Вызвать такси в отдел продаж', 'Маршрут в Яндекс Картах', 'Маршрут в Google Maps'])
    for (const a of links) expect(a.attributes).toMatchObject({ target: '_blank', rel: 'noopener' })
  })

  it('старый CSS блока сохранён, секция карты дописана в конец', () => {
    const css = structure.metadata!.globalCss as string
    expect(css.startsWith(BLOCK.metadata!.globalCss as string)).toBe(true)
    expect(css.endsWith(PROJECT_MAP_CSS)).toBe(true)
  })

  it('все новые узлы в полной форме — редактор их откроет', () => {
    expect(incompleteNodes(byId(structure, 'project-map-repeat'))).toEqual([])
    expect(incompleteNodes(byId(structure, 'location-trip'))).toEqual([])
  })

  it('вход не меняется', () => {
    expect(bySource(BLOCK, 'item.locationLabels')).toHaveLength(1)
    expect(bySource(BLOCK, 'item.mapHouse')).toHaveLength(0)
  })
})

describe('migrateLocationBlock — повтор и ошибки', () => {
  it('повторный запуск ничего не меняет', () => {
    const once = migrateLocationBlock(BLOCK).structure
    const twice = migrateLocationBlock(once)
    expect(twice.alreadyMigrated).toBe(true)
    expect(twice.changes).toEqual([])
    expect(twice.structure).toBe(once)
  })

  it('старая версия CSS-секции заменяется, остальное не трогается', () => {
    const once = migrateLocationBlock(BLOCK).structure
    const css = once.metadata!.globalCss as string
    once.metadata!.globalCss = css.replace(PROJECT_MAP_CSS_MARKER, '/* ==== project-map v0 ====') + '\n.old-rule{}'
    const again = migrateLocationBlock(once)
    expect(again.changes).toEqual(['Локация: CSS карты проекта'])
    const next = again.structure.metadata!.globalCss as string
    expect(next.endsWith(PROJECT_MAP_CSS)).toBe(true)
    expect(next).not.toContain('project-map v0')
    expect(next).not.toContain('.old-rule')
  })

  it('без повтора картинки карты — ошибка, а не половинчатая правка', () => {
    const broken = clone(BLOCK)
    const visual = findAll(broken, (n) => n.attributes?.id === 'locationVisual')[0]
    visual.children = visual.children!.filter((c) => c._repeat?.source !== 'item.mapImages')
    expect(() => migrateLocationBlock(broken)).toThrow(MigrationError)
  })

  it('чужой блок без рамки карты — ошибка', () => {
    expect(() => migrateLocationBlock({ id: 'x', tagName: 'section', children: [] })).toThrow(/location-visual/)
  })
})

describe('на странице — после подстановки данных проекта', () => {
  it('точки, легенда с иконкой и рантайм карты', () => {
    const html = render(ITEM)
    expect(html).toContain('class="project-map" data-map=""')
    expect(html).toMatch(
      /<li[^>]*data-map-point="" data-id="p1" data-kind="place" data-type="school" data-lat="41.301" data-lng="69.28" data-color="#2f6fdf" data-distance="≈ 110 м"/
    )
    expect(html).toContain('data-map-point-name="">Школа №1</span>')
    expect(html).toContain('data-map-filter="school"')
    expect(html).toContain('style="--map-color: #2f6fdf"')
    // Иконка — разметкой, не текстом: html-code выводит содержимое как есть.
    expect(html).toContain('<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>')
    expect(html).toContain('window.ghProjectMap')
    // Метки-заглушки больше не выводятся, хотя в данных они ещё есть.
    expect(html).not.toContain('map-label accent')
  })

  it('ссылки поездки ведут к отделу продаж', () => {
    const html = render(ITEM)
    expect(html).toContain(
      'href="https://3.redirect.appmetrica.yandex.com/route?end-lat=41.3&amp;end-lon=69.29&amp;ref=gh.uz&amp;appmetrica_tracking_id=1178268795219780156"'
    )
    expect(html).toContain('href="https://yandex.uz/maps/?rtext=~41.3,69.29&amp;rtt=auto"')
    expect(html).toContain('href="https://www.google.com/maps/dir/?api=1&amp;destination=41.3,69.29"')
    expect(html).toContain('>ул. Навои, 1</span>')
  })

  it('без точки дома — ни карты, ни скрипта, ни кнопок поездки', () => {
    const html = render(NO_MAP)
    expect(html).not.toContain('data-map=')
    expect(html).not.toContain('window.ghProjectMap')
    expect(html).not.toContain('appmetrica')
    expect(html).toContain('Территория большой жизни')
  })

  it('без отдела продаж — карта есть, кнопок поездки нет', () => {
    const html = render({ ...ITEM, mapOffices: [] })
    expect(html).toContain('data-map=""')
    expect(html).not.toContain('Вызвать такси')
  })

  it('ни одно поле шаблона не осталось неподставленным', () => {
    expect(render(ITEM)).not.toMatch(/\{\{/)
  })
})
