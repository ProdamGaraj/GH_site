/**
 * Карта проекта: точки, расстояния, сборка данных для страницы, схемы и
 * переводы названий мест.
 */
import { buildTranslationRows, groupTranslations } from '../services/adminSerialize'
import { buildComplexDetail, ComplexRow, TrRow } from '../services/i18n'
import { iconSvg, isMapIcon, MAP_ICONS } from '../services/mapIcons'
import {
  buildProjectMap,
  distanceMeters,
  formatDistance,
  missingPlaceTypes,
  parseCoordinates,
  PlaceTypeRow,
  readPoint,
} from '../services/projectMap'
import { createPlaceTypeSchema, mapPlacesSchema, salesOfficeSchema, updateComplexSchema } from '../schemas/estate.schema'

const HOUSE = { lat: 41.3111, lng: 69.2797 }
const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`

const type = (key: string, order: number, extra: Partial<PlaceTypeRow> = {}): PlaceTypeRow => ({
  key,
  nameRu: key === 'school' ? 'Школа' : 'Парк',
  nameUz: key === 'school' ? 'Maktab' : '',
  nameEn: key === 'school' ? 'School' : 'Park',
  icon: key === 'school' ? 'school' : 'trees',
  color: key === 'school' ? '#2f6fdf' : '#3f9b4a',
  order,
  hidden: false,
  ...extra,
})
const TYPES = [type('school', 10), type('park', 20)]

describe('точки и координаты', () => {
  it('readPoint: широта и долгота в своих пределах, строки-числа тоже', () => {
    expect(readPoint({ lat: 41.31, lng: 69.28 })).toEqual({ lat: 41.31, lng: 69.28 })
    expect(readPoint({ lat: '41.31', lng: '69.28' })).toEqual({ lat: 41.31, lng: 69.28 })
    expect(readPoint({ lat: 91, lng: 0 })).toBeNull()
    expect(readPoint({ lat: 0, lng: -181 })).toBeNull()
    expect(readPoint({ lat: 'abc', lng: 1 })).toBeNull()
    expect(readPoint({ lat: '', lng: 1 })).toBeNull()
    expect(readPoint(null)).toBeNull()
  })

  it('parseCoordinates: как копируют из Яндекс и Google Карт', () => {
    expect(parseCoordinates('41.311081, 69.240562')).toEqual({ lat: 41.311081, lng: 69.240562 })
    expect(parseCoordinates(' 41.31;69.28 ')).toEqual({ lat: 41.31, lng: 69.28 })
    expect(parseCoordinates('41.31 69.28')).toEqual({ lat: 41.31, lng: 69.28 })
    expect(parseCoordinates('41,31; 69,28')).toEqual({ lat: 41.31, lng: 69.28 })
    expect(parseCoordinates('41,31 69,28')).toEqual({ lat: 41.31, lng: 69.28 })
  })

  it('parseCoordinates: неоднозначное и мусор — null', () => {
    expect(parseCoordinates('41,31, 69,28')).toBeNull()
    expect(parseCoordinates('Ташкент')).toBeNull()
    expect(parseCoordinates('41.31')).toBeNull()
    expect(parseCoordinates('95.1, 69.2')).toBeNull()
  })
})

describe('расстояние', () => {
  it('гаверсинус: 0.001° широты ≈ 111 м, точка до себя — 0', () => {
    expect(distanceMeters(HOUSE, { lat: HOUSE.lat + 0.001, lng: HOUSE.lng })).toBeCloseTo(111.2, 0)
    expect(distanceMeters(HOUSE, HOUSE)).toBe(0)
  })

  it('до километра — метры с шагом 10, не меньше 10; дальше — км с одной цифрой', () => {
    expect(formatDistance(3, 'ru')).toBe('≈ 10 м')
    expect(formatDistance(447, 'ru')).toBe('≈ 450 м')
    expect(formatDistance(994, 'ru')).toBe('≈ 990 м')
    expect(formatDistance(995, 'ru')).toBe('≈ 1,0 км')
    expect(formatDistance(1234, 'ru')).toBe('≈ 1,2 км')
  })

  it('единицы по языку: uz — m/km с запятой, en — точка', () => {
    expect(formatDistance(450, 'uz')).toBe('≈ 450 m')
    expect(formatDistance(1234, 'uz')).toBe('≈ 1,2 km')
    expect(formatDistance(1234, 'en')).toBe('≈ 1.2 km')
  })
})

describe('buildProjectMap', () => {
  const places = [
    { id: ID(1), type: 'park', name: 'Парк', lat: HOUSE.lat + 0.002, lng: HOUSE.lng },
    { id: ID(2), type: 'school', name: 'Школа №2', lat: HOUSE.lat + 0.004, lng: HOUSE.lng },
    { id: ID(3), type: 'school', name: 'Школа №1', lat: HOUSE.lat + 0.001, lng: HOUSE.lng },
  ]
  const input = { name: 'Doʼstlik', housePoint: HOUSE, salesOffice: { ...HOUSE, lng: HOUSE.lng + 0.01, address: 'ул. Навои, 1' }, places }

  it('нет точки дома — карты нет: все списки пустые', () => {
    expect(buildProjectMap({ ...input, housePoint: null }, TYPES, 'ru')).toEqual({ mapPoints: [], mapLegend: [], mapOffices: [] })
  })

  it('точки: дом, отдел продаж, места — по порядку типа, внутри ближние первыми', () => {
    const map = buildProjectMap(input, TYPES, 'ru')
    expect(map.mapPoints.map((p) => [p.kind, p.name])).toEqual([
      ['house', 'Doʼstlik'],
      ['office', 'Отдел продаж'],
      ['place', 'Школа №1'],
      ['place', 'Школа №2'],
      ['place', 'Парк'],
    ])
    expect(map.mapPoints[0].distance).toBe('')
    expect(map.mapPoints[2]).toMatchObject({ type: 'school', color: '#2f6fdf', distance: '≈ 110 м' })
  })

  it('отдел продаж: списком 0..1 для кнопок поездки, с адресом', () => {
    expect(buildProjectMap(input, TYPES, 'ru').mapOffices).toEqual([
      { name: 'Отдел продаж', address: 'ул. Навои, 1', lat: HOUSE.lat, lng: HOUSE.lng + 0.01 },
    ])
    expect(buildProjectMap({ ...input, salesOffice: null }, TYPES, 'ru').mapOffices).toEqual([])
  })

  it('легенда — только использованные типы, по порядку, с числом, цветом и SVG', () => {
    const { mapLegend } = buildProjectMap(input, TYPES, 'ru')
    expect(mapLegend.map((l) => [l.type, l.name, l.count])).toEqual([
      ['school', 'Школа', 2],
      ['park', 'Парк', 1],
    ])
    expect(mapLegend[0].icon).toBe(iconSvg('school'))
  })

  it('скрытый и неизвестный тип, кривые точки и пустые названия — отбрасываются, остальное остаётся', () => {
    const noisy = [
      ...places,
      { id: ID(4), type: 'metro', name: 'Метро', lat: HOUSE.lat, lng: HOUSE.lng },
      { id: ID(5), type: 'school', name: 'Школа в море', lat: 200, lng: 0 },
      { id: ID(6), type: 'school', name: '  ', lat: HOUSE.lat, lng: HOUSE.lng },
      'мусор',
    ]
    const map = buildProjectMap({ ...input, places: noisy }, [type('school', 10), type('park', 20, { hidden: true })], 'ru')
    expect(map.mapPoints.filter((p) => p.kind === 'place').map((p) => p.name)).toEqual(['Школа №1', 'Школа №2'])
    expect(map.mapLegend.map((l) => l.type)).toEqual(['school'])
  })

  it('язык: название типа, подпись отдела, перевод места по id и адреса; пустой перевод — ru', () => {
    const uz = buildProjectMap(
      { ...input, placeNames: { [ID(3)]: 'Maktab №1', [ID(2)]: '  ' }, salesOfficeAddress: 'Navoiy koʻchasi, 1' },
      TYPES,
      'uz'
    )
    expect(uz.mapPoints.map((p) => p.name)).toEqual(['Doʼstlik', 'Sotuv ofisi', 'Maktab №1', 'Школа №2', 'Парк'])
    expect(uz.mapOffices[0].address).toBe('Navoiy koʻchasi, 1')
    // у парка нет uz-названия типа — ru
    expect(uz.mapLegend.map((l) => l.name)).toEqual(['Maktab', 'Парк'])
    expect(buildProjectMap(input, TYPES, 'en').mapLegend.map((l) => l.name)).toEqual(['School', 'Park'])
  })
})

describe('missingPlaceTypes', () => {
  it('ключи мест, которых нет в справочнике, — без повторов', () => {
    expect(missingPlaceTypes([{ type: 'school' }, { type: 'zoo' }, { type: 'zoo' }], ['school', 'park'])).toEqual(['zoo'])
    expect(missingPlaceTypes([], ['school'])).toEqual([])
  })
})

describe('иконки', () => {
  it('набор без повторов ключей, у каждой — подпись и контуры', () => {
    expect(new Set(MAP_ICONS.map((i) => i.key)).size).toBe(MAP_ICONS.length)
    for (const icon of MAP_ICONS) {
      expect(icon.label).not.toBe('')
      expect(icon.body).toMatch(/<(path|circle|rect|line|polyline)/)
    }
  })

  it('iconSvg — готовый svg 24×24 под currentColor; чужой ключ — null', () => {
    expect(iconSvg('school')).toMatch(/^<svg [^>]*viewBox="0 0 24 24"[^>]*stroke="currentColor"/)
    expect(iconSvg('nope')).toBeNull()
    expect(isMapIcon('trees')).toBe(true)
    expect(isMapIcon(5)).toBe(false)
  })
})

describe('схемы', () => {
  it('места: координаты в пределах, uuid, название; id не повторяются', () => {
    const ok = { id: ID(1), type: 'school', name: 'Школа', lat: 41.3, lng: 69.2 }
    expect(mapPlacesSchema.safeParse([ok]).success).toBe(true)
    expect(mapPlacesSchema.safeParse([{ ...ok, lat: 91 }]).success).toBe(false)
    expect(mapPlacesSchema.safeParse([{ ...ok, id: 'x' }]).success).toBe(false)
    expect(mapPlacesSchema.safeParse([{ ...ok, name: '  ' }]).success).toBe(false)
    expect(mapPlacesSchema.safeParse([ok, ok]).success).toBe(false)
  })

  it('ЖК: точку дома и отдел продаж можно убрать (null)', () => {
    expect(updateComplexSchema.safeParse({ housePoint: null, salesOffice: null, places: [] }).success).toBe(true)
    expect(salesOfficeSchema.safeParse({ lat: 41.3, lng: 69.2, address: 'Навои, 1' }).success).toBe(true)
    expect(updateComplexSchema.safeParse({ housePoint: { lat: 41.3 } }).success).toBe(false)
  })

  it('тип места: ключ латиницей, иконка из набора, цвет #rrggbb', () => {
    const ok = { key: 'kids-club', nameRu: 'Детский клуб', icon: 'baby', color: '#ff8800' }
    expect(createPlaceTypeSchema.safeParse(ok).success).toBe(true)
    expect(createPlaceTypeSchema.safeParse({ ...ok, key: 'Школа' }).success).toBe(false)
    expect(createPlaceTypeSchema.safeParse({ ...ok, icon: 'rocket' }).success).toBe(false)
    expect(createPlaceTypeSchema.safeParse({ ...ok, color: 'red' }).success).toBe(false)
  })
})

describe('через DTO проекта и переводы админки', () => {
  const complex = {
    id: 'c1',
    slug: 'dostlik',
    order: 0,
    status: 'active',
    name: 'Doʼstlik',
    housePoint: HOUSE,
    salesOffice: { lat: HOUSE.lat, lng: HOUSE.lng + 0.01, address: 'Навои, 1' },
    places: [{ id: ID(1), type: 'school', name: 'Школа №1', lat: HOUSE.lat + 0.001, lng: HOUSE.lng }],
  } as unknown as ComplexRow

  it('buildComplexDetail отдаёт карту; переводы названий места — по id из оверлея языка', () => {
    const translations: TrRow[] = [
      { entityType: 'complex', entityId: 'c1', locale: 'uz', field: 'placeNames', value: JSON.stringify({ [ID(1)]: 'Maktab №1' }) },
      { entityType: 'complex', entityId: 'c1', locale: 'uz', field: 'salesOfficeAddress', value: 'Navoiy, 1' },
    ]
    const dto = buildComplexDetail(complex, [], [], translations, 'uz', [], TYPES)
    expect(dto.mapPoints.map((p) => p.name)).toEqual(['Doʼstlik', 'Sotuv ofisi', 'Maktab №1'])
    expect(dto.mapOffices[0].address).toBe('Navoiy, 1')
    expect(buildComplexDetail(complex, [], [], [], 'ru').mapPoints).toHaveLength(2) // без типов мест — только дом и офис
  })

  it('админка: placeNames пишется JSON-строкой и читается обратно объектом', () => {
    const rows = buildTranslationRows('complex', 'c1', { uz: { placeNames: { [ID(1)]: 'Maktab №1' }, salesOfficeAddress: 'Navoiy, 1' } })
    expect(rows.find((r) => r.field === 'placeNames')?.value).toBe(JSON.stringify({ [ID(1)]: 'Maktab №1' }))
    const back = groupTranslations(rows.map((r) => ({ ...r })) as TrRow[]).get('c1')!
    expect(back.uz.placeNames).toEqual({ [ID(1)]: 'Maktab №1' })
    expect(back.uz.salesOfficeAddress).toBe('Navoiy, 1')
  })
})
