import { describe, it, expect } from 'vitest'
import { applicableBreakpointIds, computeBreakpointRanges, rangeMatchesWidth } from './breakpointRanges'

// Стандартный набор сайта (порядок как в metadata страницы — не по ширине).
const standard = [
  { id: 'desktop-hd', width: 1440 },
  { id: 'desktop-fhd', width: 1920 },
  { id: 'tablet', width: 768 },
  { id: 'mobile', width: 375 },
]

describe('computeBreakpointRanges — те же границы, что на бэкенде', () => {
  it('самый широкий — min-width, остальные — до следующего более широкого − 1', () => {
    expect(computeBreakpointRanges(standard)).toEqual([
      { id: 'desktop-fhd', width: 1920, minWidth: 1920, maxWidth: null },
      { id: 'desktop-hd', width: 1440, minWidth: null, maxWidth: 1919 },
      { id: 'tablet', width: 768, minWidth: null, maxWidth: 1439 },
      { id: 'mobile', width: 375, minWidth: null, maxWidth: 767 },
    ])
  })

  it('единственный breakpoint — max-width по своей ширине', () => {
    expect(computeBreakpointRanges([{ id: 'only', width: 1024 }])).toEqual([
      { id: 'only', width: 1024, minWidth: null, maxWidth: 1024 },
    ])
  })

  it('пустой список и мусорные записи', () => {
    expect(computeBreakpointRanges([])).toEqual([])
    expect(computeBreakpointRanges(undefined as any)).toEqual([])
    expect(computeBreakpointRanges([null as any, { id: 'x' } as any, { id: 'a', width: 500 }])).toEqual([
      { id: 'a', width: 500, minWidth: null, maxWidth: 500 },
    ])
  })
})

describe('rangeMatchesWidth', () => {
  const [fhd, hd, tablet] = computeBreakpointRanges(standard)

  it('границы включительно', () => {
    expect(rangeMatchesWidth(fhd, 1920)).toBe(true)
    expect(rangeMatchesWidth(fhd, 1919)).toBe(false)
    expect(rangeMatchesWidth(hd, 1919)).toBe(true)
    expect(rangeMatchesWidth(hd, 1920)).toBe(false)
    expect(rangeMatchesWidth(tablet, 1439)).toBe(true)
    expect(rangeMatchesWidth(tablet, 1440)).toBe(false)
  })
})

describe('applicableBreakpointIds — какие экраны действуют на канвасе breakpoint\'а', () => {
  it('телефон получает Desktop HD и планшет, потом свои правки', () => {
    expect(applicableBreakpointIds(standard, 'mobile')).toEqual(['desktop-hd', 'tablet', 'mobile'])
  })

  it('планшет получает Desktop HD, но не телефон и не FHD', () => {
    expect(applicableBreakpointIds(standard, 'tablet')).toEqual(['desktop-hd', 'tablet'])
  })

  it('Desktop HD — только свои правки', () => {
    expect(applicableBreakpointIds(standard, 'desktop-hd')).toEqual(['desktop-hd'])
  })

  it('самый широкий экран не получает правок более узких', () => {
    expect(applicableBreakpointIds(standard, 'desktop-fhd')).toEqual(['desktop-fhd'])
  })

  it('свой breakpoint между стандартными встаёт в каскад по ширине', () => {
    const withCustom = [...standard, { id: 'laptop', width: 1280 }]
    // laptop действует до 1439, tablet теперь до 1279.
    expect(applicableBreakpointIds(withCustom, 'laptop')).toEqual(['desktop-hd', 'laptop'])
    expect(applicableBreakpointIds(withCustom, 'tablet')).toEqual(['desktop-hd', 'laptop', 'tablet'])
  })

  it('неизвестный breakpoint или нет списка — только он сам', () => {
    expect(applicableBreakpointIds(standard, 'nope')).toEqual(['nope'])
    expect(applicableBreakpointIds(undefined, 'mobile')).toEqual(['mobile'])
    expect(applicableBreakpointIds([], 'mobile')).toEqual(['mobile'])
  })
})
