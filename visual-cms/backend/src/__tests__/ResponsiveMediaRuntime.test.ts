import { generateResponsiveMediaRuntime } from '../services/ResponsiveMediaRuntime'
import { generateCarouselRuntime } from '../services/CarouselRuntime'

describe('generateResponsiveMediaRuntime', () => {
  const js = generateResponsiveMediaRuntime()

  it('оборачивается в <script> и читает брейкпоинты из window.__ghBreakpoints', () => {
    expect(js.startsWith('<script>')).toBe(true)
    expect(js.trimEnd().endsWith('</script>')).toBe(true)
    expect(js).toContain('window.__ghBreakpoints')
  })

  it('свапит по data-rmedia (bg → backgroundImage, src → setAttribute)', () => {
    expect(js).toContain("getAttribute('data-rmedia')")
    expect(js).toContain('style.backgroundImage')
    expect(js).toContain("setAttribute('src'")
  })

  it('смена src у <video> вызывает load(), без смены — не трогает элемент', () => {
    // guard от перезапуска видео на каждом resize
    expect(js).toContain("el.getAttribute('src') !== v")
    expect(js).toContain("el.tagName === 'VIDEO'")
    expect(js).toContain('el.load()')
  })

  it('выбирает наименьший подходящий брейкпоинт по boundary (границы диапазонов) и наблюдает DOM', () => {
    expect(js).toContain('w <= boundOf(bp)')
    // boundary null = самый широкий breakpoint, не ограничен сверху
    expect(js).toContain('bp.boundary === null')
    expect(js).toContain('MutationObserver')
    expect(js).toContain('window.__ghRMedia')
  })

  it('является валидным JS (парсится как функция)', () => {
    const body = js.replace(/^<script>/, '').replace(/<\/script>\s*$/, '')
    expect(() => new Function(body)).not.toThrow()
  })
})

describe('generateCarouselRuntime — не задет', () => {
  it('по-прежнему генерируется', () => {
    expect(generateCarouselRuntime()).toContain('data-carousel')
  })
})
