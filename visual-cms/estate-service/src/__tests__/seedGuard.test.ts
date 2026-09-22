/**
 * Защита сида от стирания синхронизации.
 *
 * `seed:design` идемпотентен через УДАЛЕНИЕ комплекса по slug, а дома,
 * квартиры и типы планировок уходят за ним по FK CASCADE. На связанном с CRM
 * проекте один прогон уничтожал результат многоминутного синка под лимитом в
 * 100 запросов в минуту. Здесь проверяется решение «отказать или нет».
 */
import { syncedApartments, refuseReseedReason } from '../scripts/seed-design-projects'

const house = (...externalIds: Array<number | null>) => ({
  apartments: externalIds.map((externalId) => ({ externalId })),
})

describe('syncedApartments', () => {
  it('считает только квартиры с externalId — они и есть результат синка', () => {
    expect(syncedApartments({ houses: [house(1, 2, null, null)] })).toBe(2)
  })

  it('суммирует по всем корпусам', () => {
    expect(syncedApartments({ houses: [house(1), house(2, 3)] })).toBe(3)
  })

  it('демо-квартиры из сида не считаются: у них externalId нет', () => {
    expect(syncedApartments({ houses: [house(null, null)] })).toBe(0)
  })

  it('проект без корпусов и неполные объекты не роняют подсчёт', () => {
    expect(syncedApartments({ houses: [] })).toBe(0)
    expect(syncedApartments({})).toBe(0)
    expect(syncedApartments({ houses: [{}] })).toBe(0)
  })
})

describe('refuseReseedReason', () => {
  it('проект с квартирами из CRM пересоздавать отказываемся', () => {
    const reason = refuseReseedReason('assalom-dostlik', { houses: [house(1, 2, 3)] }, false)
    expect(reason).toContain('assalom-dostlik')
    expect(reason).toContain('3')
    // Отказ обязан подсказывать безопасный путь, иначе его обойдут --force.
    expect(reason).toContain('update-project-content.ts')
    expect(reason).toContain('--force')
  })

  it('проект без связи с CRM пересоздаётся молча — для того сид и есть', () => {
    expect(refuseReseedReason('harizma', { houses: [house(null)] }, false)).toBeNull()
    expect(refuseReseedReason('ozmakon', { houses: [] }, false)).toBeNull()
  })

  it('--force снимает запрет: осознанное пересоздание остаётся возможным', () => {
    expect(refuseReseedReason('assalom-dostlik', { houses: [house(1, 2)] }, true)).toBeNull()
  })
})
