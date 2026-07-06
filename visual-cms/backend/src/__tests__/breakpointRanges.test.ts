/**
 * Границы @media из breakpointRanges: breakpoint хранит дизайн-ширину, а
 * диапазон применения тянется до соседнего breakpoint'а. Регресс-кейс бага:
 * mobile(375) при старой схеме `max-width: 375px` не покрывал телефоны
 * 390–430px — они получали tablet-стили.
 */
import { computeBreakpointRanges, breakpointRangeMap } from '../services/breakpointRanges'
import type { BreakpointDef } from '../types/blockNode'

const BPS: BreakpointDef[] = [
  { id: 'desktop-fhd', name: 'Desktop FHD', width: 1920 },
  { id: 'desktop-hd', name: 'Desktop HD', width: 1440 },
  { id: 'tablet', name: 'Tablet', width: 768 },
  { id: 'mobile', name: 'Mobile', width: 375 },
]

describe('computeBreakpointRanges', () => {
  it('самый широкий → min-width, остальные → max-width до соседа − 1', () => {
    const ranges = computeBreakpointRanges(BPS)
    expect(ranges.map(r => ({ id: r.id, media: r.media }))).toEqual([
      { id: 'desktop-fhd', media: '(min-width: 1920px)' },
      { id: 'desktop-hd', media: '(max-width: 1919px)' },
      { id: 'tablet', media: '(max-width: 1439px)' },
      { id: 'mobile', media: '(max-width: 767px)' },
    ])
  })

  it('регресс бага: телефон 390–430px попадает в диапазон mobile', () => {
    const mobile = breakpointRangeMap(BPS).get('mobile')!
    expect(mobile.maxWidth).toBe(767)
    // старая схема: maxWidth был 375 и вьюпорт 390 выпадал из mobile
    expect(390).toBeLessThanOrEqual(mobile.maxWidth!)
    expect(430).toBeLessThanOrEqual(mobile.maxWidth!)
  })

  it('порядок эмиссии — по убыванию ширины (каскад: меньший экран побеждает)', () => {
    const ids = computeBreakpointRanges(BPS).map(r => r.id)
    expect(ids).toEqual(['desktop-fhd', 'desktop-hd', 'tablet', 'mobile'])
  })

  it('несортированный вход сортируется', () => {
    const shuffled = [BPS[2], BPS[0], BPS[3], BPS[1]]
    expect(computeBreakpointRanges(shuffled).map(r => r.id))
      .toEqual(['desktop-fhd', 'desktop-hd', 'tablet', 'mobile'])
  })

  it('единственный breakpoint — легаси max-width по своей ширине', () => {
    const ranges = computeBreakpointRanges([{ id: 'only', name: 'Only', width: 768 }])
    expect(ranges).toHaveLength(1)
    expect(ranges[0].media).toBe('(max-width: 768px)')
  })

  it('breakpoint без числовой ширины отбрасывается', () => {
    const ranges = computeBreakpointRanges([
      { id: 'ok', name: 'Ok', width: 768 },
      { id: 'broken', name: 'Broken' } as unknown as BreakpointDef,
    ])
    expect(ranges.map(r => r.id)).toEqual(['ok'])
  })

  it('пустой вход → пустой результат', () => {
    expect(computeBreakpointRanges([])).toEqual([])
    expect(breakpointRangeMap([]).size).toBe(0)
  })
})
