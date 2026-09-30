/**
 * @jest-environment jsdom
 *
 * Карусель и тема шапки: событие carousel:change при смене слайда и оценка
 * кадра видео (data-header-theme-live). canvas в jsdom нет — getContext
 * подменён: «кадр» — это яркость, которую вернёт getImageData.
 */
import { generateCarouselRuntime } from '../services/CarouselRuntime'

let frame = 20
let tainted = false
const draws: unknown[][] = []

beforeAll(() => {
  ;(HTMLCanvasElement.prototype as any).getContext = function () {
    return {
      drawImage: (...args: unknown[]) => draws.push(args),
      getImageData: () => {
        if (tainted) throw new DOMException('tainted', 'SecurityError')
        return { data: new Uint8ClampedArray(8 * 4 * 4).fill(frame) }
      },
    }
  }
})

beforeEach(() => {
  jest.useFakeTimers()
  frame = 20
  tainted = false
  draws.length = 0
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
})

afterEach(() => {
  jest.useRealTimers()
  document.body.innerHTML = ''
})

function mount(slides: string, rootTop = 0): { root: HTMLElement; events: Array<{ index: number; reason: string }> } {
  document.body.innerHTML = `
    <div id="hero" data-carousel="true" data-carousel-effect="none">
      <div data-carousel-track="true">${slides}</div>
      <button data-carousel-next>›</button>
    </div>`
  const root = document.getElementById('hero')!
  root.getBoundingClientRect = () => ({ top: rootTop, bottom: rootTop + 600, left: 0, right: 1440, width: 1440, height: 600 }) as DOMRect
  const events: Array<{ index: number; reason: string }> = []
  document.addEventListener('carousel:change', (e) => {
    const d = (e as CustomEvent).detail
    events.push({ index: d.index, reason: d.reason })
  })
  const script = generateCarouselRuntime()
  new Function(script.slice(script.indexOf('<script>') + 8, script.lastIndexOf('</script>')))()
  return { root, events }
}

/** Видео слайда «играет» и отдаёт кадры. */
function playing(slideId: string): HTMLVideoElement {
  const video = document.querySelector(`#${slideId} video[data-carousel-video="true"]`) as HTMLVideoElement
  for (const [key, value] of Object.entries({ readyState: 4, paused: false, videoWidth: 1920, videoHeight: 1080 })) {
    Object.defineProperty(video, key, { configurable: true, value })
  }
  return video
}

const next = () => (document.querySelector('[data-carousel-next]') as HTMLButtonElement).click()
const live = (id: string) => document.getElementById(id)!.getAttribute('data-header-theme-live')

const PHOTO_THEN_VIDEO = `
  <div id="s0" data-carousel-slide="true" data-header-theme="light"></div>
  <div id="s1" data-carousel-slide="true" data-slide-video="/media/v.mp4"></div>`

describe('событие carousel:change', () => {
  it('при запуске и при смене слайда — с индексом активного слайда', () => {
    const { events } = mount(PHOTO_THEN_VIDEO)
    expect(events).toEqual([{ index: 0, reason: 'slide' }])
    next()
    expect(events[events.length - 1]).toEqual({ index: 1, reason: 'slide' })
  })
})

describe('кадр видео → data-header-theme-live', () => {
  it('тёмный кадр — тема «тёмный» с первой же оценки, и шапке сообщают', () => {
    const { events } = mount(PHOTO_THEN_VIDEO)
    next()
    playing('s1')
    jest.advanceTimersByTime(1000)
    expect(live('s1')).toBe('dark')
    expect(events[events.length - 1]).toEqual({ index: 1, reason: 'theme' })
    // Оценивается верхняя четверть кадра, центральные 70% ширины, в картинку 8×4.
    expect(draws[0].slice(1)).toEqual([1920 * 0.15, 0, 1920 * 0.7, 1080 * 0.25, 0, 0, 8, 4])
  })

  it('смена темы — только после двух одинаковых оценок подряд (шапка не мигает)', () => {
    mount(PHOTO_THEN_VIDEO)
    next()
    playing('s1')
    jest.advanceTimersByTime(1000)
    frame = 230
    jest.advanceTimersByTime(1000)
    expect(live('s1')).toBe('dark')
    jest.advanceTimersByTime(1000)
    expect(live('s1')).toBe('light')
  })

  it('полутон между порогами тему не меняет', () => {
    mount(PHOTO_THEN_VIDEO)
    next()
    playing('s1')
    frame = 230
    jest.advanceTimersByTime(1000)
    expect(live('s1')).toBe('light')
    frame = 140
    jest.advanceTimersByTime(5000)
    expect(live('s1')).toBe('light')
  })

  it('раз в секунду, а не чаще', () => {
    mount(PHOTO_THEN_VIDEO)
    next()
    playing('s1')
    jest.advanceTimersByTime(3000)
    expect(draws).toHaveLength(3)
  })

  it('у слайда своя метка — кадры не оцениваются', () => {
    mount(`<div id="s0" data-carousel-slide="true"></div>
           <div id="s1" data-carousel-slide="true" data-slide-video="/media/v.mp4" data-header-theme="dark"></div>`)
    next()
    playing('s1')
    jest.advanceTimersByTime(3000)
    expect(draws).toHaveLength(0)
    expect(live('s1')).toBeNull()
  })

  it('карусель не у верха экрана (под шапкой её нет) — не оцениваются', () => {
    mount(PHOTO_THEN_VIDEO, 900)
    next()
    playing('s1')
    jest.advanceTimersByTime(3000)
    expect(draws).toHaveLength(0)
  })

  it('вкладка скрыта — не оцениваются', () => {
    mount(PHOTO_THEN_VIDEO)
    next()
    playing('s1')
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    jest.advanceTimersByTime(3000)
    expect(draws).toHaveLength(0)
  })

  it('ушли на фото-слайд — слежение остановлено', () => {
    mount(PHOTO_THEN_VIDEO)
    next()
    playing('s1')
    jest.advanceTimersByTime(1000)
    next()
    const before = draws.length
    jest.advanceTimersByTime(5000)
    expect(draws).toHaveLength(before)
  })

  it('видео с чужого сервера без CORS (canvas «испорчен») — слежение выключается, без ошибок', () => {
    tainted = true
    mount(PHOTO_THEN_VIDEO)
    next()
    playing('s1')
    expect(() => jest.advanceTimersByTime(3000)).not.toThrow()
    expect(draws).toHaveLength(1)
    expect(live('s1')).toBeNull()
  })
})
