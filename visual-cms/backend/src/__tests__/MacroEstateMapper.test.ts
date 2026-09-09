/**
 * Маппер объектов продажи MacroCRM.
 *
 * Половина проверок идёт на фикстуре из живой CRM (100 квартир дома 5139395):
 * синтетика показала бы зелёное и ничего не доказала — весь смысл маппера
 * в том, чтобы пережить настоящую пустоту настоящих данных.
 */
import {
  mapApartment,
  mapApartments,
  mapStatus,
  formatFloor,
  type MacroSellItem,
} from '../services/MacroEstateMapper'
import { priceFromMinorUnits, areaOrNull } from '../services/macroUnits'

const FIXTURE: MacroSellItem[] = require('./fixtures/macro/02-apartments.json')
const ALL_STATUSES: MacroSellItem[] = require('./fixtures/macro/03-apartments-all.json')

/** Квартира 5139781 из документации: на ней сверялись единицы измерения. */
const SAMPLE: MacroSellItem = {
  id: 5139781,
  houseId: 5139395,
  complexId: 5139393,
  status: 20,
  category: 'flat',
  dateModified: '2026-08-19T17:58:58+05:00',
  number: '74',
  entrance: 1,
  floor: 12,
  rooms: 2,
  areaTotal: 55.63,
  price: 115377956200,
  priceMaxDiscount: 115377956200,
  currency: 'uzs',
  isStudio: false,
  windowView: 'ОзМакон 1&2',
  panoUrl: 'https://gh.widget.getfloorplan.com/beta/?id=770d4cf6',
}

describe('единицы измерения', () => {
  it('цена делится на 100 ровно один раз', () => {
    expect(priceFromMinorUnits(115377956200)).toBe(1153779562)
  })

  it('цена сходится с priceM2 из того же объекта', () => {
    // priceM2 у 5139781 = 2074024019 тийинов = 20 740 240.19 сум за м².
    const price = priceFromMinorUnits(115377956200)!
    expect(Math.round(price / 55.63)).toBe(Math.round(2074024019 / 100))
  })

  it('ноль и отрицательные — это отсутствие цены, а не нулевая цена', () => {
    expect(priceFromMinorUnits(0)).toBeNull()
    expect(priceFromMinorUnits(-500)).toBeNull()
    expect(priceFromMinorUnits(null)).toBeNull()
    expect(priceFromMinorUnits('мусор')).toBeNull()
  })

  it('площадь округляется до сотых — разница в 0.01 м² у них значима', () => {
    expect(areaOrNull(55.634)).toBe(55.63)
    expect(areaOrNull(55.636)).toBe(55.64)
    expect(areaOrNull(0)).toBeNull()
  })
})

describe('статусы', () => {
  it('свободно — единственный доступный статус', () => {
    expect(mapStatus(20)).toBe('available')
  })

  it('бронь и сделка в работе — занято, но не продано', () => {
    expect(mapStatus(30)).toBe('reserved')
    expect(mapStatus(32)).toBe('reserved')
    expect(mapStatus(50)).toBe('reserved')
  })

  it('проведённая сделка — продано', () => {
    expect(mapStatus(100)).toBe('sold')
    expect(mapStatus(52)).toBe('sold')
  })

  it('неизвестный статус прячется, а не выдаётся за свободный', () => {
    expect(mapStatus(999)).toBe('hidden')
    expect(mapStatus(null)).toBe('hidden')
    expect(mapStatus('свободно')).toBe('hidden')
  })
})

describe('этаж', () => {
  it('склеивается с этажностью дома', () => {
    expect(formatFloor(12, 15)).toBe('12/15')
  })

  it('без этажности дома остаётся числом', () => {
    expect(formatFloor(12, null)).toBe('12')
    expect(formatFloor(12, 0)).toBe('12')
  })

  it('без этажа даёт пустую строку, а не «null/15»', () => {
    expect(formatFloor(null, 15)).toBe('')
  })
})

describe('одна квартира', () => {
  it('разбирается целиком', () => {
    const m = mapApartment(SAMPLE, { floorsCount: 15 })!
    expect(m).toMatchObject({
      externalId: 5139781,
      externalHouseId: 5139395,
      rooms: 2,
      areaM2: 55.63,
      price: 1153779562,
      oldPrice: null,
      entrance: 1,
      floorNumber: 12,
      floor: '12/15',
      number: '74',
      isStudio: false,
      windowView: 'ОзМакон 1&2',
      status: 'available',
    })
  })

  it('дата приводится к ISO', () => {
    expect(mapApartment(SAMPLE)!.dateModified).toBe('2026-08-19T12:58:58.000Z')
  })

  it('битая дата не роняет разбор', () => {
    expect(mapApartment({ ...SAMPLE, dateModified: 'вчера' })!.dateModified).toBeNull()
    expect(mapApartment({ ...SAMPLE, dateModified: null })!.dateModified).toBeNull()
  })

  it('скидка становится ценой, прайс уходит в зачёркнутую', () => {
    const m = mapApartment({ ...SAMPLE, priceMaxDiscount: 100000000000 })!
    expect(m.price).toBe(1000000000)
    expect(m.oldPrice).toBe(1153779562)
  })

  it('скидка, равная прайсу, зачёркнутой цены не создаёт', () => {
    expect(mapApartment(SAMPLE)!.oldPrice).toBeNull()
  })

  it('скидка больше прайса игнорируется — это ошибка данных, а не подарок', () => {
    const m = mapApartment({ ...SAMPLE, priceMaxDiscount: 200000000000 })!
    expect(m.price).toBe(1153779562)
    expect(m.oldPrice).toBeNull()
  })
})

describe('пустота в данных', () => {
  it('объект, где заполнены только идентификаторы и площадь, разбирается', () => {
    const m = mapApartment({ id: 1, houseId: 2, areaTotal: 40 })!
    expect(m).toMatchObject({
      externalId: 1,
      externalHouseId: 2,
      areaM2: 40,
      rooms: 0,
      price: 0,
      oldPrice: null,
      entrance: null,
      floorNumber: null,
      floor: '',
      number: '',
      isStudio: false,
      windowView: '',
      panoUrl: '',
      status: 'hidden',
      dateModified: null,
    })
  })

  it('без id, дома или площади объект непригоден', () => {
    expect(mapApartment({ houseId: 2, areaTotal: 40 })).toBeNull()
    expect(mapApartment({ id: 1, areaTotal: 40 })).toBeNull()
    expect(mapApartment({ id: 1, houseId: 2 })).toBeNull()
    expect(mapApartment({ id: 1, houseId: 2, areaTotal: 0 })).toBeNull()
  })

  it('isStudio принимает только настоящий true — строка «true» не считается', () => {
    expect(mapApartment({ ...SAMPLE, isStudio: 'true' })!.isStudio).toBe(false)
    expect(mapApartment({ ...SAMPLE, isStudio: true })!.isStudio).toBe(true)
  })
})

describe('пачка на живой выдаче', () => {
  it('фикстура на месте и не пуста', () => {
    expect(FIXTURE.length).toBe(100)
  })

  it('разбираются все сто квартир без отбраковки', () => {
    const { apartments, skipped } = mapApartments(FIXTURE, { floorsCount: 15 })
    expect(apartments).toHaveLength(100)
    expect(skipped).toHaveLength(0)
  })

  it('у каждой разобранной есть площадь и оба идентификатора', () => {
    const { apartments } = mapApartments(FIXTURE)
    for (const a of apartments) {
      expect(a.areaM2).toBeGreaterThan(0)
      expect(a.externalId).toBeGreaterThan(0)
      expect(a.externalHouseId).toBe(5139395)
    }
  })

  it('все сто в продаже — статус available', () => {
    const { apartments } = mapApartments(FIXTURE)
    expect(apartments.every((a) => a.status === 'available')).toBe(true)
  })

  it('вид из окон заполнен у всех и берётся из данных, а не выдумывается', () => {
    const { apartments } = mapApartments(FIXTURE)
    const views = new Set(apartments.map((a) => a.windowView))
    expect(views.has('')).toBe(false)
    expect(views.has('двор')).toBe(true)
  })

  it('пустые в CRM поля не превращаются в мусор', () => {
    const { apartments } = mapApartments(FIXTURE)
    // riser, section и titleImage пусты у всех ста — мы их и не читаем,
    // а panoUrl заполнен примерно у половины.
    const withPano = apartments.filter((a) => a.panoUrl !== '')
    expect(withPano.length).toBeGreaterThan(0)
    expect(withPano.length).toBeLessThan(apartments.length)
  })

  it('цены остаются в разумных пределах после деления', () => {
    const { apartments } = mapApartments(FIXTURE)
    for (const a of apartments) {
      // Самая дешёвая квартира дома по статистике Macro — 845 861 909 сум.
      expect(a.price).toBeGreaterThan(100_000_000)
      expect(a.price).toBeLessThan(100_000_000_000)
    }
  })

  it('нежилые категории отсекаются, даже если серверный фильтр их пропустил', () => {
    const mixed = [
      ...FIXTURE.slice(0, 3),
      { id: 1, houseId: 5139395, areaTotal: 15, category: 'garage' },
      { id: 2, houseId: 5139395, areaTotal: 40, category: 'comm' },
    ]
    const { apartments, skipped } = mapApartments(mixed)
    expect(apartments).toHaveLength(3)
    expect(skipped.map((s) => s.reason)).toEqual(['категория garage', 'категория comm'])
  })

  it('выдача без фильтра статусов даёт все четыре наших состояния', () => {
    const { apartments } = mapApartments(ALL_STATUSES)
    const statuses = new Set(apartments.map((a) => a.status))
    expect(statuses.has('available')).toBe(true)
    expect(statuses.has('reserved')).toBe(true)
    expect(statuses.has('sold')).toBe(true)
  })

  it('externalId уникальны — на них стоит upsert синка', () => {
    const { apartments } = mapApartments(FIXTURE)
    expect(new Set(apartments.map((a) => a.externalId)).size).toBe(apartments.length)
  })
})
