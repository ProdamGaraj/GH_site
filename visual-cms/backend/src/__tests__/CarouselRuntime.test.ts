/**
 * @jest-environment jsdom
 *
 * CarouselRuntime tests.
 * Проверяем инжектируемый JS:
 *  - инициализирует track/slides/dots
 *  - снапшотит inline-стили активной/неактивной точки
 *  - ротейтит активность по prev/next/click-on-dot
 *  - реагирует на MutationObserver
 *  - применяет правильный transform
 *  - игнорирует скрытый template-слайд
 */

import { generateCarouselRuntime } from '../services/CarouselRuntime'

const RUNTIME_HTML = generateCarouselRuntime() // <script>...</script>
const RUNTIME_JS = RUNTIME_HTML.replace(/^<script>/, '').replace(/<\/script>$/, '')

const buildBody = (slidesCount: number, dotsCount: number = slidesCount): string => {
  const slides = Array.from({ length: slidesCount }).map((_, i) =>
    `<div data-carousel-slide="true" data-element-id="slide-${i}" style="background-color:rgb(${i * 30},0,0)">Slide ${i}</div>`
  ).join('')
  const dots = Array.from({ length: dotsCount }).map((_, i) => {
    const style = i === 0
      ? 'width: 32px; height: 10px; background-color: #D29F66'
      : 'width: 10px; height: 10px; background-color: rgba(255,255,255,0.5)'
    return `<div data-carousel-dot="true" data-element-id="dot-${i}" style="${style}"></div>`
  }).join('')
  return `
    <div data-carousel="true" data-carousel-autoplay="0" data-carousel-loop="true" data-element-id="root">
      <div data-carousel-track="true" data-element-id="track">${slides}</div>
      <div data-carousel-dots="true" data-element-id="dots">${dots}</div>
      <button data-carousel-prev="true">prev</button>
      <button data-carousel-next="true">next</button>
    </div>
  `
}

const boot = async (bodyHtml: string) => {
  document.body.innerHTML = bodyHtml
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  new Function(RUNTIME_JS)()
  await new Promise(r => setTimeout(r, 20))
}

const dotsAt = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-carousel-dots] > *'))

const trackEl = () => document.querySelector<HTMLElement>('[data-carousel-track="true"]')!

describe('CarouselRuntime', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('init + dots snapshot', () => {
    it('инициализирует layout track (flex, width N*100%)', async () => {
      await boot(buildBody(3))
      const track = trackEl()
      expect(track.style.display).toBe('flex')
      expect(track.style.width).toBe('300%')
      expect(track.style.transform).toMatch(/translateX\(-?0%\)/)
      const slides = document.querySelectorAll<HTMLElement>('[data-carousel-slide="true"]')
      expect(slides.length).toBe(3)
      slides.forEach(s => expect(s.style.flex).toMatch(/^0 0 33\.3{6,}\d*%$/))
    })

    it('запоминает inline-стили dot[0]=active и dot[1]=inactive', async () => {
      await boot(buildBody(3))
      const dots = dotsAt()
      expect(dots[0].style.width).toBe('32px')
      expect(dots[1].style.width).toBe('10px')
      expect(dots[2].style.width).toBe('10px')
    })

    it('после клика по next активность сдвигается на dot[1]', async () => {
      await boot(buildBody(3))
      const next = document.querySelector<HTMLElement>('[data-carousel-next]')!
      next.click()
      const dots = dotsAt()
      expect(dots[0].style.width).toBe('10px')
      expect(dots[1].style.width).toBe('32px')
      expect(dots[2].style.width).toBe('10px')
      expect(trackEl().style.transform).toBe('translateX(-33.333333333333336%)')
    })

    it('prev из позиции 0 уходит на последний слайд (loop=true)', async () => {
      await boot(buildBody(3))
      document.querySelector<HTMLElement>('[data-carousel-prev]')!.click()
      const dots = dotsAt()
      expect(dots[2].style.width).toBe('32px')
      expect(dots[0].style.width).toBe('10px')
    })

    it('клик по конкретной точке переключает на неё', async () => {
      await boot(buildBody(3))
      const dots = dotsAt()
      dots[2].click()
      expect(dots[2].style.width).toBe('32px')
      expect(dots[0].style.width).toBe('10px')
      expect(dots[1].style.width).toBe('10px')
    })
  })

  describe('dots template fallback', () => {
    it('если в dots-контейнере один шаблон — клонирует по числу слайдов', async () => {
      await boot(buildBody(3, 1))
      expect(dotsAt()).toHaveLength(3)
    })

    it('regression: existing.length != slides.length наследует inactive-стиль', async () => {
      // Bug: пользователь добавил 5-й слайд в repeat-mode → существующих dots всё ещё 4 →
      // попадаем в Case 2 (clone template). Без pre-snapshot все 5 клонов получали
      // активный inline-стиль (width:32px) → визуально все точки выглядели как активная.
      await boot(buildBody(5, 4))
      const dots = dotsAt()
      expect(dots).toHaveLength(5)
      // dot[0] активен → 32px; остальные должны быть unactive 10px (унаследован из existing[1]).
      expect(dots[0].style.width).toBe('32px')
      expect(dots[1].style.width).toBe('10px')
      expect(dots[2].style.width).toBe('10px')
      expect(dots[3].style.width).toBe('10px')
      expect(dots[4].style.width).toBe('10px')
    })
  })

  describe('counter (data-carousel-counter)', () => {
    it('обновляет "01 / 04" на старте и при смене слайда', async () => {
      await boot(`
        <div data-carousel="true" data-carousel-autoplay="0" data-carousel-loop="true">
          <div data-carousel-track="true">
            <div data-carousel-slide="true">A</div>
            <div data-carousel-slide="true">B</div>
            <div data-carousel-slide="true">C</div>
            <div data-carousel-slide="true">D</div>
          </div>
          <span data-carousel-counter="true"></span>
          <button data-carousel-next="true">next</button>
        </div>
      `)
      const counter = document.querySelector<HTMLElement>('[data-carousel-counter]')!
      expect(counter.textContent).toBe('01 / 04')
      document.querySelector<HTMLElement>('[data-carousel-next]')!.click()
      expect(counter.textContent).toBe('02 / 04')
    })
  })

  describe('video backgrounds (data-slide-video)', () => {
    it('лениво создаёт <video> на активном слайде, не трогает неактивный', async () => {
      await boot(`
        <div data-carousel="true" data-carousel-autoplay="0" data-carousel-loop="true">
          <div data-carousel-track="true">
            <div data-carousel-slide="true" data-slide-video="https://cdn/a.mp4" data-element-id="s0"></div>
            <div data-carousel-slide="true" data-slide-video="https://cdn/b.mp4" data-element-id="s1"></div>
          </div>
          <button data-carousel-next="true">next</button>
        </div>
      `)
      const s0 = document.querySelector('[data-element-id="s0"]')!
      const s1 = document.querySelector('[data-element-id="s1"]')!

      const v0 = s0.querySelector<HTMLVideoElement>('video[data-carousel-video="true"]')
      expect(v0).toBeTruthy()
      expect(v0!.querySelector('source')!.getAttribute('src')).toBe('https://cdn/a.mp4')
      expect(v0!.loop).toBe(true)
      expect(v0!.hasAttribute('muted')).toBe(true)
      expect(v0!.hasAttribute('playsinline')).toBe(true)
      // неактивный слайд — видео ещё не создано (ленивость)
      expect(s1.querySelector('video[data-carousel-video="true"]')).toBeNull()

      document.querySelector<HTMLElement>('[data-carousel-next]')!.click()
      expect(s1.querySelector('video[data-carousel-video="true"]')).toBeTruthy()
    })
  })

  describe('MutationObserver', () => {
    it('перерисовывается при добавлении нового слайда в track', async () => {
      await boot(buildBody(2))
      const track = trackEl()
      const newSlide = document.createElement('div')
      newSlide.setAttribute('data-carousel-slide', 'true')
      newSlide.setAttribute('style', 'background-color: rgb(99,99,99)')
      newSlide.textContent = 'Slide 2'
      track.appendChild(newSlide)
      await new Promise(r => setTimeout(r, 30))
      expect(track.style.width).toBe('300%')
      expect(document.querySelectorAll('[data-carousel-slide="true"]').length).toBe(3)
    })
  })

  describe('hidden template slide', () => {
    it('исключает скрытый template-слайд (display:none) из счёта slides', async () => {
      await boot(`
        <div data-carousel="true" data-carousel-autoplay="0">
          <div data-carousel-track="true">
            <div data-carousel-slide="true" style="display:none">TEMPLATE</div>
            <div data-carousel-slide="true" style="background:#111">A</div>
            <div data-carousel-slide="true" style="background:#222">B</div>
          </div>
          <div data-carousel-dots="true">
            <div data-carousel-dot="true" style="width:32px"></div>
            <div data-carousel-dot="true" style="width:10px"></div>
          </div>
        </div>
      `)
      expect(trackEl().style.width).toBe('200%')
    })
  })

  describe('layout cleanup of competing inline styles', () => {
    it('очищает min-width/max-width у слайдов (защита от hybrid-static и legacy-данных)', async () => {
      // Воспроизводим кейс из БД: hybrid-static-слайд имеет inline min-width:100%,
      // что в flex-item резолвится от track-width = N*100% viewport и растягивает
      // слайд на N viewports. Runtime обязан их сбрасывать.
      await boot(`
        <div data-carousel="true" data-carousel-autoplay="0">
          <div data-carousel-track="true">
            <div data-carousel-slide="true" style="min-width:100%; max-width:50%; background:#111">A</div>
            <div data-carousel-slide="true" style="background:#222">B</div>
            <div data-carousel-slide="true" style="background:#333">C</div>
          </div>
          <div data-carousel-dots="true">
            <div data-carousel-dot="true" style="width:32px"></div>
            <div data-carousel-dot="true" style="width:10px"></div>
            <div data-carousel-dot="true" style="width:10px"></div>
          </div>
        </div>
      `)
      const slides = document.querySelectorAll<HTMLElement>('[data-carousel-slide="true"]')
      expect(slides.length).toBe(3)
      slides.forEach(s => {
        expect(s.style.minWidth).toBe('')
        expect(s.style.maxWidth).toBe('')
        // Width переписан runtime'ом на (100/n)%
        expect(s.style.width).toMatch(/^33\.3{6,}\d*%$/)
      })
    })
  })
})
