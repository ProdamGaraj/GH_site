import {
  formatArea,
  groupThousands,
  formatPrice,
  apartmentTitle,
  apartmentMeta,
  toNumber,
  ApartmentRow,
} from '../services/i18n'

describe('toNumber', () => {
  it('parses pg string bigints/numerics', () => {
    expect(toNumber('1354320000')).toBe(1354320000)
    expect(toNumber('78.81')).toBe(78.81)
  })
  it('handles null/undefined/empty as 0', () => {
    expect(toNumber(null)).toBe(0)
    expect(toNumber(undefined)).toBe(0)
    expect(toNumber('')).toBe(0)
  })
})

describe('formatArea', () => {
  it('drops trailing zeros', () => {
    expect(formatArea('114.00')).toBe('114')
    expect(formatArea(114)).toBe('114')
  })
  it('keeps real decimals', () => {
    expect(formatArea('78.81')).toBe('78.81')
    expect(formatArea('65.41')).toBe('65.41')
  })
})

describe('groupThousands / formatPrice', () => {
  it('groups digits by spaces', () => {
    expect(groupThousands(1354320000)).toBe('1 354 320 000')
    expect(groupThousands(936748269)).toBe('936 748 269')
  })
  it('formats price with UZS suffix', () => {
    expect(formatPrice('1354320000')).toBe('1 354 320 000 UZS')
  })
  it('returns empty for zero/absent price', () => {
    expect(formatPrice(0)).toBe('')
    expect(formatPrice(null)).toBe('')
    expect(formatPrice(undefined)).toBe('')
  })
})

describe('apartmentTitle', () => {
  it('ru format', () => {
    expect(apartmentTitle(4, '114.00', 'ru')).toBe('4-комн. 114 м²')
    expect(apartmentTitle(3, '78.81', 'ru')).toBe('3-комн. 78.81 м²')
  })
  it('uz format', () => {
    expect(apartmentTitle(4, 114, 'uz')).toBe('4 xonali 114 m²')
  })
  it('en format', () => {
    expect(apartmentTitle(4, 114, 'en')).toBe('4-room 114 m²')
  })
})

describe('apartmentMeta', () => {
  const apt: ApartmentRow = {
    id: 'a1',
    houseId: 'h1',
    order: 0,
    rooms: 4,
    areaM2: '114.00',
    price: '1354320000',
    oldPrice: '1539000000',
    entrance: 2,
    apartmentClass: 'Бизнес',
    badges: ['Акция'],
    floor: '8/9',
    number: '102',
    deadline: '1 кв. 2028',
    offerLabel: 'Акция',
    status: 'available',
    planImage: '',
  }

  it('ru meta matches the card format', () => {
    expect(apartmentMeta(apt, 'ru')).toBe('№ 102 | 8/9 этаж | 2 подъезд | 1 кв. 2028')
  })
  it('uz meta uses uz words', () => {
    expect(apartmentMeta(apt, 'uz')).toBe('№ 102 | 8/9 qavat | 2 kirish | 1 кв. 2028')
  })
  it('en meta puts words before value', () => {
    expect(apartmentMeta(apt, 'en')).toBe('No. 102 | floor 8/9 | entrance 2 | 1 кв. 2028')
  })
  it('skips absent entrance segment', () => {
    const noEntrance = { ...apt, entrance: null }
    expect(apartmentMeta(noEntrance, 'ru')).toBe('№ 102 | 8/9 этаж | 1 кв. 2028')
  })
})
