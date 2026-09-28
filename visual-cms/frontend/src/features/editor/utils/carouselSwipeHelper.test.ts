import { describe, it, expect } from 'vitest'
import { SWIPE_ATTR, defaultSwipeScreens, readSwipeScreens, swipeAttrValue } from './carouselSwipeHelper'

/** Экраны страниц сайта — как в редакторе. */
const SITE = [
  { id: 'desktop-fhd', width: 1920 },
  { id: 'desktop-hd', width: 1440 },
  { id: 'tablet', width: 768 },
  { id: 'mobile', width: 375 },
]

describe('readSwipeScreens', () => {
  it('экраны из атрибута, пробелы и пустые части отбрасываются', () => {
    expect(readSwipeScreens({ attributes: { [SWIPE_ATTR]: 'mobile, tablet,,' } })).toEqual(['mobile', 'tablet'])
  })

  it('нет атрибута или пусто — выключено', () => {
    expect(readSwipeScreens({ attributes: {} })).toEqual([])
    expect(readSwipeScreens({ attributes: { [SWIPE_ATTR]: '' } })).toEqual([])
    expect(readSwipeScreens({})).toEqual([])
  })
})

describe('defaultSwipeScreens', () => {
  it('по умолчанию — телефон и планшет (экраны уже 1024 px)', () => {
    expect(defaultSwipeScreens(SITE)).toEqual(['tablet', 'mobile'])
  })

  it('у страницы только широкие экраны — все', () => {
    expect(defaultSwipeScreens([{ id: 'hd', width: 1440 }, { id: 'fhd', width: 1920 }])).toEqual(['hd', 'fhd'])
  })
})

describe('swipeAttrValue', () => {
  it('экраны в порядке брейкпоинтов страницы, без повторов и чужих id', () => {
    expect(swipeAttrValue(['mobile', 'desktop-hd', 'mobile', 'gone'], SITE)).toBe('desktop-hd,mobile')
  })

  it('ни одного экрана — пустое значение: «выключено» записано явно', () => {
    expect(swipeAttrValue([], SITE)).toBe('')
  })
})
