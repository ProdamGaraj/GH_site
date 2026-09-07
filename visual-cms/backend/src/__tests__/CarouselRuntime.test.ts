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
      expect(v0!.style.objectFit).toBe('cover') // дефолт
      expect(v0!.loop).toBe(true)
      expect(v0!.hasAttribute('muted')).toBe(true)
      expect(v0!.hasAttribute('playsinline')).toBe(true)
      // неактивный слайд — видео ещё не создано (ленивость)
      expect(s1.querySelector('video[data-carousel-video="true"]')).toBeNull()

      document.querySelector<HTMLElement>('[data-carousel-next]')!.click()
      expect(s1.querySelector('video[data-carousel-video="true"]')).toBeTruthy()
    })

    it('object-fit видео берётся из data-slide-fit', async () => {
      await boot(`
        <div data-carousel="true" data-carousel-autoplay="0">
          <div data-carousel-track="true">
            <div data-carousel-slide="true" data-slide-video="https://cdn/a.mp4" data-slide-fit="contain" data-element-id="s0"></div>
          </div>
        </div>
      `)
      const v = document
        .querySelector('[data-element-id="s0"]')!
        .querySelector<HTMLVideoElement>('video[data-carousel-video="true"]')!
      expect(v.style.objectFit).toBe('contain')
    })
  })

  describe('video-wait (смотреть видео до конца)', () => {
    const bodyWithVideo = (autoplay: number, wait: boolean) => `
      <div data-carousel="true" data-carousel-autoplay="${autoplay}"${wait ? ' data-carousel-video-wait="true"' : ''}>
        <div data-carousel-track="true">
          <div data-carousel-slide="true" data-slide-video="https://cdn/a.mp4" data-element-id="s0"></div>
          <div data-carousel-slide="true" data-element-id="s1" style="background:#111"></div>
        </div>
      </div>
    `
    const videoOf = (id: string) =>
      document.querySelector(`[data-element-id="${id}"]`)!.querySelector<HTMLVideoElement>('video[data-carousel-video="true"]')!

    it('video-wait + autoplay → активное видео НЕ зациклено (loop=false)', async () => {
      await boot(bodyWithVideo(1000, true))
      expect(videoOf('s0').loop).toBe(false)
    })

    it('video-wait без autoplay → видео всё ещё зациклено (loop=true)', async () => {
      await boot(bodyWithVideo(0, true))
      expect(videoOf('s0').loop).toBe(true)
    })

    it('autoplay без video-wait → видео зациклено (loop=true)', async () => {
      await boot(bodyWithVideo(1000, false))
      expect(videoOf('s0').loop).toBe(true)
    })

    it('video-wait: событие ended активного видео листает на следующий слайд', async () => {
      await boot(bodyWithVideo(1000, true))
      expect(trackEl().style.transform).toMatch(/translateX\(-?0%\)/)
      videoOf('s0').dispatchEvent(new Event('ended'))
      expect(trackEl().style.transform).toBe('translateX(-50%)')
    })

    it('video-wait: событие error видео тоже листает дальше (fallback)', async () => {
      await boot(bodyWithVideo(1000, true))
      videoOf('s0').dispatchEvent(new Event('error'))
      expect(trackEl().style.transform).toBe('translateX(-50%)')
    })

    it('video-wait: автоплей не уходит со слайда, пока видео не доиграло', () => {
      jest.useFakeTimers()
      try {
        document.body.innerHTML = bodyWithVideo(50, true)
        // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
        new Function(RUNTIME_JS)()
        jest.advanceTimersByTime(500) // 10 интервалов — видео «играет» (ended=false), не листаем
        expect(trackEl().style.transform).toMatch(/translateX\(-?0%\)/)
        videoOf('s0').dispatchEvent(new Event('ended'))
        expect(trackEl().style.transform).toBe('translateX(-50%)')
      } finally {
        jest.useRealTimers()
      }
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

// ─────────────────────────────────────────────────────────────
// Типы перехода (data-carousel-effect)
// ─────────────────────────────────────────────────────────────

const buildEffectBody = (effect: string, slidesCount = 3, extraRootAttrs = ''): string => {
  const slides = Array.from({ length: slidesCount }).map((_, i) =>
    `<div data-carousel-slide="true" data-element-id="slide-${i}">Slide ${i}</div>`
  ).join('')
  return `
    <div data-carousel="true" data-carousel-autoplay="0" data-carousel-effect="${effect}"
         ${extraRootAttrs} data-element-id="root">
      <div data-carousel-track="true" data-element-id="track">${slides}</div>
      <button data-carousel-prev="true">prev</button>
      <button data-carousel-next="true">next</button>
    </div>
  `
}
const slidesOf = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-carousel-slide="true"]'))
const clickNext = () =>
  document.querySelector<HTMLElement>('[data-carousel-next]')!.click()

describe('CarouselRuntime — типы перехода', () => {
  afterEach(() => { document.body.innerHTML = '' })

  describe('slide (по умолчанию) не изменился', () => {
    it('без атрибута эффекта раскладка остаётся flex-треком', async () => {
      await boot(buildBody(3))
      expect(trackEl().style.display).toBe('flex')
      expect(trackEl().style.width).toBe('300%')
    })
    it('листание двигает трек по горизонтали', async () => {
      await boot(buildEffectBody('slide'))
      clickNext()
      expect(trackEl().style.transform).toContain('translateX')
    })
  })

  describe('slide-vertical', () => {
    it('трек становится колонкой и тянется по высоте', async () => {
      await boot(buildEffectBody('slide-vertical'))
      expect(trackEl().style.flexDirection).toBe('column')
      expect(trackEl().style.height).toBe('300%')
    })
    it('листание двигает трек по вертикали', async () => {
      await boot(buildEffectBody('slide-vertical'))
      clickNext()
      expect(trackEl().style.transform).toContain('translateY')
    })
  })

  describe('fade', () => {
    it('трек не растягивается и не двигается', async () => {
      await boot(buildEffectBody('fade'))
      expect(trackEl().style.display).toBe('block');
      expect(trackEl().style.transform).toBe('')
      expect(trackEl().style.width).toBe('')
    })
    it('активен только один слайд, у остальных нулевая прозрачность', async () => {
      await boot(buildEffectBody('fade'))
      const s = slidesOf()
      expect(s[0].style.opacity).toBe('1')
      expect(s[1].style.opacity).toBe('0')
      expect(s[2].style.opacity).toBe('0')
    })
    it('класс активного слайда переезжает при листании', async () => {
      await boot(buildEffectBody('fade'))
      expect(slidesOf()[0].classList.contains('is-active')).toBe(true)
      clickNext()
      expect(slidesOf()[0].classList.contains('is-active')).toBe(false)
      expect(slidesOf()[1].classList.contains('is-active')).toBe(true)
      expect(slidesOf()[1].style.opacity).toBe('1')
    })
    it('активный слайд лежит выше остальных', async () => {
      await boot(buildEffectBody('fade'))
      expect(slidesOf()[0].style.zIndex).toBe('1')
      expect(slidesOf()[1].style.zIndex).toBe('0')
    })
    it('слайдам назначается transition с длительностью эффекта', async () => {
      await boot(buildEffectBody('fade'))
      expect(slidesOf()[0].style.transition).toContain('600ms')
    })
    it('класс активного слайда переопределяется атрибутом', async () => {
      await boot(buildEffectBody('fade', 3, 'data-carousel-slide-active-class="current"'))
      expect(slidesOf()[0].classList.contains('current')).toBe(true)
      expect(slidesOf()[0].classList.contains('is-active')).toBe(false)
    })
  })

  describe('zoom', () => {
    it('неактивные слайды масштабируются, активный возвращается к единице', async () => {
      await boot(buildEffectBody('zoom'))
      expect(slidesOf()[0].style.transform).toBe('scale(1)')
      expect(slidesOf()[1].style.transform).toBe('scale(1.06)')
    })
    it('zoom-out уводит неактивные в меньший масштаб', async () => {
      await boot(buildEffectBody('zoom-out'))
      expect(slidesOf()[1].style.transform).toBe('scale(0.94)')
    })
  })

  describe('none', () => {
    it('переход мгновенный — transition отключён', async () => {
      await boot(buildEffectBody('none'))
      expect(slidesOf()[0].style.transition).toBe('none')
    })
  })

  describe('устойчивость к неверным значениям', () => {
    it('неизвестный эффект ведёт себя как slide, а не роняет карусель', async () => {
      await boot(buildEffectBody('черипусеньки'))
      expect(trackEl().style.display).toBe('flex')
      clickNext()
      expect(trackEl().style.transform).toContain('translateX')
    })
    it('своя длительность из data-carousel-duration', async () => {
      await boot(buildEffectBody('fade', 3, 'data-carousel-duration="1200"'))
      expect(slidesOf()[0].style.transition).toContain('1200ms')
    })
    it('отрицательная длительность игнорируется в пользу дефолта эффекта', async () => {
      await boot(buildEffectBody('fade', 3, 'data-carousel-duration="-5"'))
      expect(slidesOf()[0].style.transition).toContain('600ms')
    })
  })

  describe('счётчик и стрелки работают одинаково во всех режимах', () => {
    it('fade: prev с первого слайда уводит на последний при loop', async () => {
      await boot(buildEffectBody('fade'))
      document.querySelector<HTMLElement>('[data-carousel-prev]')!.click()
      expect(slidesOf()[2].classList.contains('is-active')).toBe(true)
    })
  })
})

describe('CarouselRuntime — галерея внутри медиа-карточки', () => {
  afterEach(() => { document.body.innerHTML = '' })

  // Форма из блока «двор»: корень — сама карточка, трек лежит отдельным слоем,
  // слайды уже позиционированы абсолютно вёрсткой.
  const galleryBody = (n = 3) => {
    const slides = Array.from({ length: n }).map((_, i) =>
      `<div class="gallery-slide" data-carousel-slide="true"
            style="position:absolute;top:0;left:0;width:100%;height:100%;background-image:url('/media/y${i}.jpg')"></div>`
    ).join('')
    return `
      <div class="media-card gallery-media" data-carousel="true" data-carousel-effect="fade"
           data-carousel-autoplay="0" style="position:relative">
        <div class="gallery-track" data-carousel-track="true"
             style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:0">${slides}</div>
        <button class="expand-button" type="button">⛶</button>
        <button class="side-arrow left" data-carousel-prev="true" type="button">‹</button>
        <button class="side-arrow right" data-carousel-next="true" type="button">›</button>
      </div>
    `
  }
  const gSlides = () =>
    Array.from(document.querySelectorAll<HTMLElement>('.gallery-slide'))

  it('не перетирает абсолютное позиционирование, заданное вёрсткой', async () => {
    await boot(galleryBody())
    for (const s of gSlides()) {
      expect(s.style.position).toBe('absolute')
      expect(s.style.height).toBe('100%')
    }
  })

  it('не превращает трек во flex — иначе слои карточки разъедутся', async () => {
    await boot(galleryBody())
    const track = document.querySelector<HTMLElement>('.gallery-track')!
    expect(track.style.display).toBe('block')
    expect(track.style.transform).toBe('')
  })

  it('трек остаётся отдельным слоем: z-index не перебивается', async () => {
    await boot(galleryBody())
    expect(document.querySelector<HTMLElement>('.gallery-track')!.style.zIndex).toBe('0')
  })

  it('первый кадр показан, остальные скрыты', async () => {
    await boot(galleryBody())
    expect(gSlides().map((s) => s.style.opacity)).toEqual(['1', '0', '0'])
  })

  it('стрелки листают кадры', async () => {
    await boot(galleryBody())
    document.querySelector<HTMLElement>('.side-arrow.right')!.click()
    expect(gSlides().map((s) => s.style.opacity)).toEqual(['0', '1', '0'])
    document.querySelector<HTMLElement>('.side-arrow.left')!.click()
    expect(gSlides().map((s) => s.style.opacity)).toEqual(['1', '0', '0'])
  })

  it('активный кадр помечен классом — по нему лайтбокс находит текущий индекс', async () => {
    await boot(galleryBody())
    document.querySelector<HTMLElement>('.side-arrow.right')!.click()
    const active = gSlides().findIndex((s) => s.classList.contains('is-active'))
    expect(active).toBe(1)
  })

  it('фон кадра сохраняется — из него лайтбокс собирает список ссылок', async () => {
    await boot(galleryBody())
    const urls = gSlides().map((s) => (s.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/) || [])[1])
    expect(urls).toEqual(['/media/y0.jpg', '/media/y1.jpg', '/media/y2.jpg'])
  })

  it('один кадр — карусель не падает', async () => {
    await boot(galleryBody(1))
    expect(gSlides()[0].style.opacity).toBe('1')
    document.querySelector<HTMLElement>('.side-arrow.right')!.click()
    expect(gSlides()[0].style.opacity).toBe('1')
  })
})
