/**
 * Данные проектов из дизайна: инварианты, которые легко нарушить руками при
 * дозаполнении контента, и которые молча испортят витрину.
 */
import { COMPLEXES, GAPS, ComplexSeed } from '../scripts/design-projects.data'

const bySlug = (s: string): ComplexSeed => {
  const c = COMPLEXES.find((x) => x.slug === s)
  if (!c) throw new Error('нет проекта ' + s)
  return c
}
const allMedia = (c: ComplexSeed): string[] => [
  c.logo, c.media, c.aboutVideo, c.mapImage,
  ...c.heroImages, ...c.gallery, ...c.hallGallery, ...c.yardGallery,
  ...c.houses.flatMap((h) => h.apartments.map((a) => a.planImage)),
]

describe('состав набора', () => {
  it('содержит четыре проекта, названных заказчиком', () => {
    expect(COMPLEXES.map((c) => c.slug).sort()).toEqual(
      ['assalom-dostlik', 'harizma', 'ozmakon', 'ozmakon-business']
    )
  })
  it('slug уникальны — иначе сид перезатрёт сам себя', () => {
    expect(new Set(COMPLEXES.map((c) => c.slug)).size).toBe(COMPLEXES.length)
  })
  it('order уникален — иначе порядок в каталоге недетерминирован', () => {
    expect(new Set(COMPLEXES.map((c) => c.order)).size).toBe(COMPLEXES.length)
  })
})

describe('медиа-ссылки', () => {
  it('непустые ссылки указывают в медиатеку CMS, а не на файлы дизайна', () => {
    for (const c of COMPLEXES) {
      for (const url of allMedia(c).filter(Boolean)) {
        expect(url).toMatch(/^\/media\/[0-9a-f-]{36}\.[a-z0-9]+$/)
      }
    }
  })
  it('не осталось путей assets/ и внешних заглушек unsplash', () => {
    const blob = JSON.stringify(COMPLEXES)
    expect(blob).not.toMatch(/assets\//)
    expect(blob).not.toMatch(/unsplash/)
  })
  it('у каждого проекта есть хотя бы один кадр героя', () => {
    for (const c of COMPLEXES) expect(c.heroImages.length).toBeGreaterThan(0)
  })
})

describe('обязательные поля витрины', () => {
  it('имя, класс и интро заполнены у всех', () => {
    for (const c of COMPLEXES) {
      expect(c.name).not.toBe('')
      expect(c.className).not.toBe('')
      expect(c.intro).not.toBe('')
    }
  })
  it('status — только active или sold_out', () => {
    for (const c of COMPLEXES) expect(['active', 'sold_out']).toContain(c.status)
  })
})

describe('квартиры', () => {
  it('демо-цены есть только у Do’stlik — чужие цены не расходятся по проектам', () => {
    for (const c of COMPLEXES) {
      const count = c.houses.reduce((n, h) => n + h.apartments.length, 0)
      if (c.slug === 'assalom-dostlik') expect(count).toBe(4)
      else expect(count).toBe(0)
    }
  })
  it('старая цена всегда выше текущей', () => {
    for (const h of bySlug('assalom-dostlik').houses) {
      for (const a of h.apartments) {
        if (a.oldPrice !== null) expect(a.oldPrice).toBeGreaterThan(a.price)
      }
    }
  })
  it('номера квартир уникальны в пределах проекта', () => {
    const nums = bySlug('assalom-dostlik').houses.flatMap((h) => h.apartments.map((a) => a.number))
    expect(new Set(nums).size).toBe(nums.length)
  })
  it('этаж квартиры соответствует этажности своего корпуса', () => {
    for (const h of bySlug('assalom-dostlik').houses) {
      for (const a of h.apartments) expect(a.floor.split('/')[1]).toBe(h.floors)
    }
  })
  it('все четыре демо-квартиры дизайна разложены по корпусам', () => {
    expect(bySlug('assalom-dostlik').houses.reduce((n, h) => n + h.apartments.length, 0)).toBe(4)
  })
})

describe('метки карты', () => {
  it('координаты заданы в процентах', () => {
    for (const c of COMPLEXES) {
      for (const l of c.locationLabels) {
        expect(l.top).toMatch(/^\d+%$/)
        expect(l.left).toMatch(/^\d+%$/)
      }
    }
  })
  it('акцентная метка не более одной на проект', () => {
    for (const c of COMPLEXES) {
      expect(c.locationLabels.filter((l) => l.accent).length).toBeLessThanOrEqual(1)
    }
  })
  it('при готовой карте метки не нужны — дизайн их снимает', () => {
    for (const c of COMPLEXES) {
      if (c.mapImage) expect(c.locationLabels).toEqual([])
    }
  })
})

describe('реестр пропусков', () => {
  it('каждый пропуск ссылается на существующий проект', () => {
    const slugs = new Set(COMPLEXES.map((c) => c.slug))
    for (const g of GAPS) expect(slugs.has(g.slug) || g.slug === '*').toBe(true)
  })
  it('у каждого пропуска указана причина', () => {
    for (const g of GAPS) expect(g.reason.length).toBeGreaterThan(10)
  })
  it('проекты без контента секций отмечены в реестре', () => {
    for (const slug of ['harizma', 'ozmakon']) {
      expect(GAPS.some((g) => g.slug === slug)).toBe(true)
    }
  })
})

describe('externalId — ключ для запроса квартир из CRM', () => {
  it('либо null, либо положительное целое', () => {
    for (const c of COMPLEXES) {
      if (c.externalId === null) continue
      expect(Number.isInteger(c.externalId)).toBe(true)
      expect(c.externalId).toBeGreaterThan(0)
    }
  })
  it('заданные значения уникальны — иначе квартиры разъедутся не по тем страницам', () => {
    const ids = COMPLEXES.map((c) => c.externalId).filter((x): x is number => x !== null)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('пока не сопоставлен ни один проект — и это отмечено в реестре пропусков', () => {
    expect(COMPLEXES.every((c) => c.externalId === null)).toBe(true)
    expect(GAPS.some((g) => g.field === 'externalId')).toBe(true)
  })
})
