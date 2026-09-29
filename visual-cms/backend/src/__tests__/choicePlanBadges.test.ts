/**
 * Бейджи групп планировок на карточках «Выбрать»: преобразование живого блока
 * (fixtures/choiceBlock.json — копия со стенда) и результат против настоящего
 * движка подстановки и генератора страницы.
 */
jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({ findOne: jest.fn(), find: jest.fn(), save: jest.fn(), findByIds: jest.fn() }),
  },
}))

import * as cheerio from 'cheerio'
import { deployService } from '../services/DeployService'
import { htmlGenerator } from '../services/HtmlGenerator'
import { MigrationError, StructureNode, findAll, hasClass, incompleteNodes } from '../scripts/choiceToPlanTypes'
import { PLAN_BADGES_CLASS, PLAN_BADGES_CSS_MARKER, migrateChoicePlanBadges } from '../scripts/choicePlanBadges'
import type { BlockNode } from '../types/blockNode'

const CHOICE: StructureNode = require('./fixtures/choiceBlock.json')
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const substitute = (structure: unknown, item: unknown) => (deployService as any).substituteItemData(structure, item)

function render(structure: StructureNode, planTypes: unknown[]) {
  const html = htmlGenerator.generatePage(substitute(structure, { className: 'Бизнес', name: 'X', planTypes }) as BlockNode, {
    metadata: { title: 'T', description: '', keywords: [] },
    slug: 'complex/x',
  })
  return cheerio.load(html)
}

const PLAN = { title: '2-комн. 55 м²', areaLabel: '55 м²', priceLabel: 'от 1 UZS', cover: [], badges: ['Акция', 'Последняя планировка'] }

describe('migrateChoicePlanBadges', () => {
  const result = migrateChoicePlanBadges(CHOICE)
  const row = findAll(result.structure, (n) => hasClass(n, 'apartment-badges'))[0]

  it('повторитель бейджей — между плашкой класса и площадью', () => {
    const kids = row.children!
    expect(kids).toHaveLength(3)
    expect(kids[0].attributes).toHaveProperty('data-apartment-class')
    expect(kids[1]).toMatchObject({ attributes: { class: PLAN_BADGES_CLASS }, _repeat: { source: '$.badges' } })
    expect(kids[1].children![0].content).toBe('{{$}}')
    expect(kids[2].content).toBe('{{$.areaLabel}}')
    expect(incompleteNodes(result.structure)).toEqual([])
  })

  it('CSS: обёртка без бокса, свой цвет, площадь осталась последней', () => {
    const css = (result.structure.metadata as any).globalCss as string
    expect(css).toContain(PLAN_BADGES_CSS_MARKER)
    expect(css).toMatch(/\.apartment-badges \.plan-badges \{\s*display: contents;/)
    expect(css).toContain('.apartment-badges .plan-badges span:last-child')
  })

  it('на странице: бейджи группы в ряду плашек, по порядку', () => {
    const $ = render(result.structure, [PLAN])
    const chips = $('.apartment-card .apartment-badges span').toArray().map((s) => $(s).text().trim())
    expect(chips).toEqual(['Бизнес', 'Акция', 'Последняя планировка', '55 м²'])
    expect($('.apartment-card .apartment-badges').children().last().text()).toBe('55 м²')
  })

  it('без бейджей — ряд как раньше, без плейсхолдеров', () => {
    const $ = render(result.structure, [{ ...PLAN, badges: [] }])
    const chips = $('.apartment-card .apartment-badges span').toArray().map((s) => $(s).text().trim())
    expect(chips).toEqual(['Бизнес', '55 м²'])
    expect($.html()).not.toContain('{{$}}')
  })

  it('повторный запуск ничего не меняет', () => {
    expect(migrateChoicePlanBadges(result.structure)).toMatchObject({ alreadyMigrated: true, changes: [] })
  })

  it('нет плашки класса — ошибка, а не бейджи не на месте', () => {
    const broken = clone(CHOICE)
    for (const n of findAll(broken, (x) => x.attributes?.['data-apartment-class'] !== undefined)) {
      delete n.attributes!['data-apartment-class']
    }
    expect(() => migrateChoicePlanBadges(broken)).toThrow(MigrationError)
  })
})
