/**
 * Экран вьюпорта в JS-рантаймах: та же семантика, что у @media и <picture>.
 * Экраны — как на страницах сайта (window.__ghBreakpoints, границы из breakpointRanges).
 */
import { BREAKPOINT_RUNTIME_JS } from '../services/breakpointRuntime'

type Bp = { id: string; width: number; boundary: number | null }
type AtFn = (bps: Bp[], w: number, accept?: (bp: Bp) => boolean) => Bp | null

// eslint-disable-next-line no-new-func
const ghBreakpointAt = new Function(`${BREAKPOINT_RUNTIME_JS}; return ghBreakpointAt;`)() as AtFn

const SITE: Bp[] = [
  { id: 'desktop-hd', width: 1440, boundary: 1919 },
  { id: 'desktop-fhd', width: 1920, boundary: null },
  { id: 'tablet', width: 768, boundary: 1439 },
  { id: 'mobile', width: 375, boundary: 767 },
]

describe('ghBreakpointAt', () => {
  it.each([
    [320, 'mobile'],
    [767, 'mobile'],
    [768, 'tablet'],
    [1439, 'tablet'],
    [1440, 'desktop-hd'],
    [1919, 'desktop-hd'],
    [1920, 'desktop-fhd'],
    [3840, 'desktop-fhd'],
  ])('ширина %i → %s', (w, id) => {
    expect(ghBreakpointAt(SITE, w)?.id).toBe(id)
  })

  it('с фильтром — наименьший подходящий экран не уже вьюпорта (как у адаптивного медиа)', () => {
    const onlyTablet = (bp: Bp) => bp.id === 'tablet'
    expect(ghBreakpointAt(SITE, 400, onlyTablet)?.id).toBe('tablet')
    expect(ghBreakpointAt(SITE, 1500, onlyTablet)).toBeNull()
  })

  it('без экранов — null', () => {
    expect(ghBreakpointAt([], 500)).toBeNull()
  })
})
