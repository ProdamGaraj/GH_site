/**
 * id планировки на карточках «Выбрать» — для заявки из окна планировки.
 */
import { migrateChoicePlanLead, PLAN_TYPE_ATTR, PLAN_TYPE_SOURCE } from '../scripts/choicePlanLead'
import type { StructureNode } from '../scripts/choiceToPlanTypes'

function block(): StructureNode {
  return {
    id: 'choice',
    tagName: 'section',
    attributes: { id: 'choice' },
    children: [
      {
        id: 'grid',
        tagName: 'div',
        attributes: { class: 'apartments-grid' },
        children: [
          {
            id: 'card',
            tagName: 'article',
            attributes: { class: 'apartment-card', 'data-rooms': '{{$.rooms}}' },
            children: [],
          },
        ],
      },
    ],
  } as unknown as StructureNode
}

const cardOf = (root: StructureNode) => root.children![0].children![0] as StructureNode

describe('migrateChoicePlanLead', () => {
  it('добавляет data-plan-type="{{$.id}}" карточке, остальное не трогает', () => {
    const input = block()
    const result = migrateChoicePlanLead(input)
    expect(cardOf(result.structure).attributes).toEqual({
      class: 'apartment-card',
      'data-rooms': '{{$.rooms}}',
      [PLAN_TYPE_ATTR]: PLAN_TYPE_SOURCE,
    })
    expect(PLAN_TYPE_SOURCE).toBe('{{$.id}}')
    expect(result.changes).toHaveLength(1)
    expect(result.alreadyMigrated).toBe(false)
    // Исходная структура не мутирована.
    expect(cardOf(input).attributes).not.toHaveProperty(PLAN_TYPE_ATTR)
  })

  it('повторный запуск — без правок', () => {
    const again = migrateChoicePlanLead(migrateChoicePlanLead(block()).structure)
    expect(again.alreadyMigrated).toBe(true)
    expect(again.changes).toEqual([])
  })

  it('нет карточки — ошибка, а не тихий пропуск', () => {
    expect(() => migrateChoicePlanLead({ id: 'x', tagName: 'div', children: [] } as unknown as StructureNode)).toThrow(
      'apartment-card'
    )
  })
})
