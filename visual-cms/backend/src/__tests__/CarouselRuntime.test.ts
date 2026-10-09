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
    <div data-carousel="true" data-carousel-autoplay="0" data-carousel-loop="true" data-carousel-infinite="false" data-element-id="root">
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

    it('object-position видео = точке фокуса постера (background-position слайда)', async () => {
      await boot(`
        <div data-carousel="true" data-carousel-autoplay="0">
          <div data-carousel-track="true">
            <div data-carousel-slide="true" data-slide-video="https://cdn/a.mp4" data-element-id="s0"
                 style="background-image:url('/p.jpg'); background-position: 30% 80%"></div>
          </div>
        </div>
      `)
      const v = document.querySelector('[data-element-id="s0"] video[data-carousel-video="true"]') as HTMLVideoElement
      expect(v.style.objectPosition).toBe('30% 80%')
    })

    it('без фокуса в вёрстке видео по центру, а не в углу', async () => {
      await boot(`
        <div data-carousel="true" data-carousel-autoplay="0">
          <div data-carousel-track="true">
            <div data-carousel-slide="true" data-slide-video="https://cdn/a.mp4" data-element-id="s0"></div>
          </div>
        </div>
      `)
      const v = document.querySelector('[data-element-id="s0"] video[data-carousel-video="true"]') as HTMLVideoElement
      expect(v.style.objectPosition).toBe('center')
    })
  })

  describe('video-wait (смотреть видео до конца)', () => {
    const bodyWithVideo = (autoplay: number, wait: boolean) => `
      <div data-carousel="true" data-carousel-autoplay="${autoplay}" data-carousel-infinite="false"${wait ? ' data-carousel-video-wait="true"' : ''}>
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
        <div data-carousel="true" data-carousel-autoplay="0" data-carousel-infinite="false">
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
        <div data-carousel="true" data-carousel-autoplay="0" data-carousel-infinite="false">
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
    <div data-carousel="true" data-carousel-autoplay="0" data-carousel-effect="${effect}" data-carousel-infinite="false"
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

  it('ширина трека из вёрстки сохраняется — иначе абсолютный трек и слайды схлопываются в 0', async () => {
    await boot(galleryBody())
    const track = document.querySelector<HTMLElement>('.gallery-track')!
    expect(track.style.width).toBe('100%')
    expect(track.style.height).toBe('100%')
    for (const s of gSlides()) expect(s.style.width).toBe('100%')
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

describe('CarouselRuntime — элементы управления по числу слайдов', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  const control = (sel: string) => document.querySelector<HTMLElement>(sel)!
  const root = () => control('[data-carousel="true"]')

  it('число слайдов пишется на корень — за него цепляется CSS вёрстки', async () => {
    await boot(buildBody(3))
    expect(root().getAttribute('data-carousel-count')).toBe('3')
  })

  it('один слайд — стрелки и точки спрятаны: листать нечего', async () => {
    await boot(buildBody(1))
    expect(root().getAttribute('data-carousel-count')).toBe('1')
    expect(control('[data-carousel-prev]').style.display).toBe('none')
    expect(control('[data-carousel-next]').style.display).toBe('none')
    expect(control('[data-carousel-dots]').style.display).toBe('none')
  })

  it('нет слайдов (пустая галерея из данных) — count=0, стрелки спрятаны', async () => {
    await boot(buildBody(0))
    expect(root().getAttribute('data-carousel-count')).toBe('0')
    expect(control('[data-carousel-next]').style.display).toBe('none')
  })

  it('два и больше — стрелки на месте', async () => {
    await boot(buildBody(2))
    expect(control('[data-carousel-prev]').style.display).toBe('')
    expect(control('[data-carousel-next]').getAttribute('data-carousel-hidden')).toBeNull()
  })

  it('слайды пришли позже (repeater) — стрелки возвращаются с исходным inline display', async () => {
    await boot(`
      <div data-carousel="true" data-carousel-autoplay="0">
        <div data-carousel-track="true"></div>
        <button data-carousel-prev="true" style="display: flex">prev</button>
        <button data-carousel-next="true">next</button>
      </div>`)
    expect(control('[data-carousel-prev]').style.display).toBe('none')
    const track = trackEl()
    track.innerHTML = '<div data-carousel-slide="true">a</div><div data-carousel-slide="true">b</div>'
    await new Promise((r) => setTimeout(r, 20))
    expect(root().getAttribute('data-carousel-count')).toBe('2')
    expect(control('[data-carousel-prev]').style.display).toBe('flex')
    expect(control('[data-carousel-next]').style.display).toBe('')
  })

  it('счётчик при одном слайде тоже прячется', async () => {
    await boot(`
      <div data-carousel="true" data-carousel-autoplay="0">
        <div data-carousel-track="true"><div data-carousel-slide="true">a</div></div>
        <span data-carousel-counter="true"></span>
      </div>`)
    expect(control('[data-carousel-counter]').style.display).toBe('none')
  })
})

describe('CarouselRuntime — класс активного слайда при сдвиге', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('эффект slide тоже ставит is-active активному слайду — по нему лайтбокс находит кадр', async () => {
    await boot(buildBody(3))
    const slides = () => Array.from(document.querySelectorAll<HTMLElement>('[data-carousel-slide="true"]'))
    expect(slides().map((s) => s.classList.contains('is-active'))).toEqual([true, false, false])
    document.querySelector<HTMLElement>('[data-carousel-next]')!.click()
    expect(slides().map((s) => s.classList.contains('is-active'))).toEqual([false, true, false])
  })
})

describe('CarouselRuntime — свайп по экранам', () => {
  /** Экраны сайта — как их выдаёт HtmlGenerator в window.__ghBreakpoints. */
  const SITE_BREAKPOINTS = [
    { id: 'desktop-hd', width: 1440, boundary: 1919 },
    { id: 'desktop-fhd', width: 1920, boundary: null },
    { id: 'tablet', width: 768, boundary: 1439 },
    { id: 'mobile', width: 375, boundary: 767 },
  ]

  const setViewport = (width: number) => {
    Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
  }

  const carousel = (swipe: string | null, slides = 3, extra = '') => {
    const attr = swipe === null ? '' : ` data-carousel-swipe="${swipe}"`
    const items = Array.from({ length: slides })
      .map((_, i) => `<div data-carousel-slide="true" data-element-id="s${i}"><a href="#s${i}" data-link="${i}">link ${i}</a></div>`)
      .join('')
    return `<div data-carousel="true" data-carousel-autoplay="0"${attr}${extra}>
      <div data-carousel-track="true">${items}</div>
      <div data-carousel-dots="true"><span data-carousel-dot="true"></span></div>
    </div>`
  }

  const active = () =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-carousel-slide="true"]')).findIndex((s) =>
      s.classList.contains('is-active')
    )

  /** Свайп на текущем экране работает (метка рантайма; вместе с ней корню ставится touch-action: pan-y). */
  const swipeActive = () => document.querySelector('[data-carousel="true"]')!.getAttribute('data-carousel-swipe-active') === 'true'

  /** Событие указателя. jsdom не знает PointerEvent — MouseEvent с полями указателя. */
  const pointer = (
    type: string,
    x: number,
    y: number,
    opts: { pointerType?: string; button?: number; isPrimary?: boolean; pointerId?: number; target?: Element } = {}
  ) => {
    const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: opts.button ?? 0 })
    Object.defineProperties(e, {
      pointerId: { value: opts.pointerId ?? 1 },
      pointerType: { value: opts.pointerType ?? 'touch' },
      isPrimary: { value: opts.isPrimary ?? true },
    })
    ;(opts.target ?? trackEl()).dispatchEvent(e)
    return e
  }

  /** Жест от (200, 300) со сдвигом dx, dy — несколькими шагами, как палец. */
  const swipe = (dx: number, dy = 0, opts: Parameters<typeof pointer>[3] = {}) => {
    pointer('pointerdown', 200, 300, opts)
    for (let i = 1; i <= 4; i++) pointer('pointermove', 200 + (dx * i) / 4, 300 + (dy * i) / 4, opts)
    pointer('pointerup', 200 + dx, 300 + dy, opts)
  }

  let play: jest.SpyInstance

  beforeEach(() => {
    ;(window as any).__ghBreakpoints = SITE_BREAKPOINTS
    setViewport(390)
    // jsdom не проигрывает видео — считаем вызовы.
    play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
  })

  afterEach(() => {
    document.body.innerHTML = ''
    delete (window as any).__ghBreakpoints
    play.mockRestore()
    jest.restoreAllMocks()
  })

  it('на телефоне: влево — следующий слайд, вправо — предыдущий', async () => {
    await boot(carousel('mobile,tablet'))
    expect(active()).toBe(0)
    swipe(-120)
    expect(active()).toBe(1)
    swipe(120)
    expect(active()).toBe(0)
  })

  it('жест, начатый на оформлении карточки поверх трека, тоже листает', async () => {
    await boot(carousel('mobile'))
    // Накладка карточки (градиент, подпись) — сосед трека, а не его потомок.
    const overlay = document.createElement('div')
    document.querySelector('[data-carousel="true"]')!.appendChild(overlay)
    swipe(-120, 0, { target: overlay })
    expect(active()).toBe(1)
  })

  it('карусель внутри карусели: жест листает только внутреннюю', async () => {
    await boot(`<div data-carousel="true" data-carousel-swipe="mobile" data-element-id="outer">
      <div data-carousel-track="true">
        <div data-carousel-slide="true" data-element-id="o0">
          <div data-carousel="true" data-carousel-swipe="mobile" data-element-id="inner">
            <div data-carousel-track="true" data-element-id="inner-track">
              <div data-carousel-slide="true">i0</div><div data-carousel-slide="true">i1</div>
            </div>
          </div>
        </div>
        <div data-carousel-slide="true" data-element-id="o1">o1</div>
      </div>
    </div>`)
    const index = (id: string) => {
      const track = document.querySelector(`[data-element-id="${id}"]`)!.querySelector('[data-carousel-track="true"]')!
      return Array.from(track.children).findIndex((s) => s.classList.contains('is-active'))
    }
    swipe(-120, 0, { target: document.querySelector('[data-element-id="inner-track"]')!.children[0] })
    expect(index('inner')).toBe(1)
    expect(index('outer')).toBe(0)
  })

  it('жест короче 40 px не листает', async () => {
    await boot(carousel('mobile,tablet'))
    swipe(-35)
    expect(active()).toBe(0)
  })

  it('на экране из списка свайп включён (корень получает touch-action: pan-y)', async () => {
    await boot(carousel('mobile,tablet'))
    expect(swipeActive()).toBe(true)
  })

  it('движение вверх-вниз отдаётся странице — слайд не меняется', async () => {
    await boot(carousel('mobile,tablet'))
    swipe(-60, 200)
    expect(active()).toBe(0)
  })

  it('экран не из списка — жестом не листается и касание не перехватывается', async () => {
    setViewport(1600)
    await boot(carousel('mobile,tablet'))
    swipe(-120, 0, { pointerType: 'mouse' })
    expect(active()).toBe(0)
    expect(swipeActive()).toBe(false)
  })

  it('без настройки жестом не листается', async () => {
    await boot(carousel(null))
    swipe(-120)
    expect(active()).toBe(0)
    expect(swipeActive()).toBe(false)
  })

  it('поворот телефона и изменение окна — настройка пересчитывается под новый экран', async () => {
    await boot(carousel('mobile'))
    expect(swipeActive()).toBe(true)
    setViewport(1000)
    window.dispatchEvent(new Event('resize'))
    expect(swipeActive()).toBe(false)
    swipe(-120)
    expect(active()).toBe(0)
  })

  it('экран компьютера в списке — листается перетаскиванием мышью', async () => {
    setViewport(1600)
    await boot(carousel('desktop-hd'))
    swipe(-120, 0, { pointerType: 'mouse' })
    expect(active()).toBe(1)
  })

  it('после перетаскивания мышью click по ссылке под курсором гасится, обычный клик проходит', async () => {
    setViewport(1600)
    await boot(carousel('desktop-hd'))
    const clicks: string[] = []
    document.addEventListener('click', (e) => clicks.push((e.target as HTMLElement).getAttribute('data-link') || ''))
    const link = document.querySelector<HTMLElement>('[data-link="0"]')!

    swipe(-120, 0, { pointerType: 'mouse', target: link })
    link.click()
    expect(clicks).toEqual([])

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000)
    link.click()
    expect(clicks).toEqual(['0'])
  })

  it('касание со сдвигом click не гасит — следующее нажатие работает', async () => {
    await boot(carousel('mobile'))
    const clicks: string[] = []
    document.addEventListener('click', (e) => clicks.push((e.target as HTMLElement).getAttribute('data-link') || ''))
    swipe(-120)
    document.querySelector<HTMLElement>('[data-link="1"]')!.click()
    expect(clicks).toEqual(['1'])
  })

  it('правая кнопка мыши и второй палец жест не начинают', async () => {
    setViewport(1600)
    await boot(carousel('desktop-hd,mobile'))
    swipe(-120, 0, { pointerType: 'mouse', button: 2 })
    expect(active()).toBe(0)
    setViewport(390)
    swipe(-120, 0, { isPrimary: false })
    expect(active()).toBe(0)
  })

  it('браузер забрал жест (pointercancel) — слайд не меняется', async () => {
    await boot(carousel('mobile'))
    pointer('pointerdown', 200, 300)
    pointer('pointermove', 100, 300)
    pointer('pointercancel', 100, 300)
    pointer('pointerup', 60, 300)
    expect(active()).toBe(0)
  })

  describe('один слайд', () => {
    const single = (extra = '') => `<div data-carousel="true" data-carousel-swipe="mobile,tablet,desktop-hd,desktop-fhd"${extra}>
      <div data-carousel-track="true"><div data-carousel-slide="true" data-slide-video="/v.mp4" data-element-id="s0"></div></div>
    </div>`

    it('жест не перехватывается ни на одном экране — страница прокручивается как обычно', async () => {
      await boot(single())
      expect(swipeActive()).toBe(false)
    })

    it('свайп не перезапускает видео (баг «О проекте»)', async () => {
      await boot(single())
      const calls = play.mock.calls.length
      swipe(-120)
      swipe(120)
      expect(play.mock.calls.length).toBe(calls)
    })

    it('«смотреть видео до конца» с автопрокруткой: одиночное видео крутится по кругу', async () => {
      await boot(single(' data-carousel-autoplay="5000" data-carousel-video-wait="true"'))
      const v = document.querySelector<HTMLVideoElement>('video[data-carousel-video="true"]')!
      expect(v.loop).toBe(true)
    })
  })

  it('нажатие на точку открытого слайда не перезапускает его видео', async () => {
    await boot(`<div data-carousel="true" data-carousel-autoplay="0">
      <div data-carousel-track="true">
        <div data-carousel-slide="true" data-slide-video="/a.mp4"></div>
        <div data-carousel-slide="true" data-slide-video="/b.mp4"></div>
      </div>
      <div data-carousel-dots="true"><span data-carousel-dot="true"></span></div>
    </div>`)
    const calls = play.mock.calls.length
    dotsAt()[0].click()
    expect(play.mock.calls.length).toBe(calls)
    dotsAt()[1].click()
    expect(play.mock.calls.length).toBe(calls + 1)
  })

  it('«смотреть видео до конца» с автопрокруткой и несколькими слайдами — видео не зациклено', async () => {
    await boot(`<div data-carousel="true" data-carousel-autoplay="5000" data-carousel-video-wait="true">
      <div data-carousel-track="true">
        <div data-carousel-slide="true" data-slide-video="/a.mp4"></div>
        <div data-carousel-slide="true" data-slide-video="/b.mp4"></div>
      </div>
    </div>`)
    expect(document.querySelector<HTMLVideoElement>('video[data-carousel-video="true"]')!.loop).toBe(false)
  })
})

describe('CarouselRuntime — бесконечная лента', () => {
  const body = (slides = 3, rootAttrs = '') => {
    const items = Array.from({ length: slides })
      .map((_, i) => `<div data-carousel-slide="true" data-element-id="slide-${i}" id="dom-${i}">Slide ${i}</div>`)
      .join('')
    return `<div data-carousel="true" data-carousel-autoplay="0"${rootAttrs}>
      <div data-carousel-track="true">${items}</div>
      <div data-carousel-dots="true"><span data-carousel-dot="true"></span></div>
      <span data-carousel-counter="true"></span>
      <button data-carousel-prev="true">prev</button>
      <button data-carousel-next="true">next</button>
    </div>`
  }
  const clonesOf = () => Array.from(trackEl().querySelectorAll<HTMLElement>('[data-carousel-clone="true"]'))
  const next = () => document.querySelector<HTMLElement>('[data-carousel-next]')!.click()
  const prev = () => document.querySelector<HTMLElement>('[data-carousel-prev]')!.click()
  const activeDot = () => dotsAt().findIndex((d) => d.classList.contains('active'))

  /** Синхронный запуск рантайма — для тестов с поддельными таймерами. */
  const bootSync = (html: string) => {
    document.body.innerHTML = html
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    new Function(RUNTIME_JS)()
  }

  afterEach(() => {
    jest.useRealTimers()
    document.body.innerHTML = ''
  })

  it('по умолчанию: по краям копии крайних слайдов, трек на две клетки длиннее, виден первый слайд', async () => {
    await boot(body(3))
    expect(trackEl().style.width).toBe('500%')
    expect(trackEl().style.transform).toBe('translateX(-20%)')
    const [tail, head] = clonesOf()
    // Копия первого — после последнего; копия последнего — в DOM тоже после слайдов,
    // а перед первым встаёт только на экране.
    expect(tail.getAttribute('data-element-id')).toBe('slide-0')
    expect(head.getAttribute('data-element-id')).toBe('slide-2')
    expect(head.style.order).toBe('-1')
  })

  it('копия — только для глаза: не слайд, без id, скрыта от диктора и клавиатуры', async () => {
    await boot(body(3))
    for (const clone of clonesOf()) {
      expect(clone.hasAttribute('data-carousel-slide')).toBe(false)
      expect(clone.hasAttribute('id')).toBe(false)
      expect(clone.getAttribute('aria-hidden')).toBe('true')
      expect(clone.hasAttribute('inert')).toBe(true)
    }
  })

  it('точки, счётчик и скрипты вёрстки видят только настоящие слайды', async () => {
    await boot(body(3))
    expect(dotsAt()).toHaveLength(3)
    expect(document.querySelector('[data-carousel]')!.getAttribute('data-carousel-count')).toBe('3')
    expect(document.querySelectorAll('[data-carousel-slide="true"]')).toHaveLength(3)
    expect(document.querySelector('[data-carousel-counter]')!.textContent).toBe('01 / 03')
    // querySelector по data-element-id находит слайд, а не его копию.
    expect(document.querySelector('[data-element-id="slide-2"]')!.hasAttribute('data-carousel-slide')).toBe(true)
  })

  it('с последнего вперёд: едет на копию первого, по окончании перехода без анимации встаёт на первый', () => {
    jest.useFakeTimers()
    bootSync(body(3))
    next()
    next()
    expect(trackEl().style.transform).toBe('translateX(-60%)')
    next()
    // Вперёд, а не назад через все слайды: клетка за последним слайдом.
    expect(trackEl().style.transform).toBe('translateX(-80%)')
    expect(activeDot()).toBe(0)
    jest.advanceTimersByTime(500)
    expect(trackEl().style.transform).toBe('translateX(-20%)')
    expect(trackEl().style.transition).toBe('transform 500ms ease')
  })

  it('с первого назад: едет на копию последнего, потом встаёт на последний', () => {
    jest.useFakeTimers()
    bootSync(body(3))
    prev()
    expect(trackEl().style.transform).toBe('translateX(0%)')
    expect(activeDot()).toBe(2)
    jest.advanceTimersByTime(500)
    expect(trackEl().style.transform).toBe('translateX(-60%)')
  })

  it('нажатие во время перескока: сначала на настоящий слайд, потом дальше — без рывка через всю ленту', () => {
    jest.useFakeTimers()
    bootSync(body(3))
    prev()
    prev()
    // Второе «назад» стартует с настоящего последнего слайда и едет на предпоследний.
    expect(trackEl().style.transform).toBe('translateX(-40%)')
    expect(activeDot()).toBe(1)
  })

  it('класс активного слайда у копии — вслед за своим слайдом', async () => {
    await boot(body(3))
    const [tail, head] = clonesOf()
    expect(tail.classList.contains('is-active')).toBe(true)
    expect(head.classList.contains('is-active')).toBe(false)
    prev()
    expect(head.classList.contains('is-active')).toBe(true)
    expect(tail.classList.contains('is-active')).toBe(false)
  })

  it('новый слайд из данных — копии пересобираются по новому краю', async () => {
    await boot(body(2))
    const slide = document.createElement('div')
    slide.setAttribute('data-carousel-slide', 'true')
    slide.setAttribute('data-element-id', 'slide-new')
    trackEl().appendChild(slide)
    await new Promise((r) => setTimeout(r, 30))
    expect(clonesOf()).toHaveLength(2)
    expect(clonesOf()[1].getAttribute('data-element-id')).toBe('slide-new')
    expect(trackEl().style.width).toBe('500%')
  })

  it('копия видео-слайда играет своё видео только на время перехода через край', () => {
    jest.useFakeTimers()
    const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
    const pause = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    bootSync(`<div data-carousel="true" data-carousel-autoplay="0">
      <div data-carousel-track="true">
        <div data-carousel-slide="true" data-slide-video="/a.mp4"></div>
        <div data-carousel-slide="true" data-slide-video="/b.mp4"></div>
      </div>
      <button data-carousel-prev="true">prev</button>
    </div>`)
    const [, head] = clonesOf()
    // Скопированный <video> не переносится: копия без видео, пока не понадобится.
    expect(head.querySelector('video')).toBeNull()
    document.querySelector<HTMLElement>('[data-carousel-prev]')!.click()
    // С первого назад лента едет на копию последнего — у неё своё видео.
    const video = head.querySelector<HTMLVideoElement>('video[data-carousel-video="true"]')!
    expect(video.querySelector('source')!.getAttribute('src')).toBe('/b.mp4')
    expect(play.mock.instances).toContain(video)
    jest.advanceTimersByTime(500)
    expect(pause.mock.instances).toContain(video)
    jest.restoreAllMocks()
  })

  it('выключатель data-carousel-infinite="false" — как раньше: без копий, с последнего назад через ленту', async () => {
    await boot(body(3, ' data-carousel-infinite="false"'))
    expect(clonesOf()).toHaveLength(0)
    expect(trackEl().style.width).toBe('300%')
    next()
    next()
    next()
    expect(trackEl().style.transform).toBe('translateX(0%)')
  })

  it.each([
    ['перетекание', ' data-carousel-effect="fade"'],
    ['без зацикливания', ' data-carousel-loop="false"'],
  ])('%s — копий нет', async (_name, attrs) => {
    await boot(body(3, attrs))
    expect(clonesOf()).toHaveLength(0)
  })

  it('один слайд — копий нет', async () => {
    await boot(body(1))
    expect(clonesOf()).toHaveLength(0)
    expect(trackEl().style.width).toBe('100%')
  })
})

describe('CarouselRuntime: подписи точек (доступность)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.documentElement.removeAttribute('lang')
  })

  it('«Слайд N из M» на языке страницы и aria-current у текущей', async () => {
    document.documentElement.setAttribute('lang', 'ru')
    await boot(buildBody(3))
    const dots = dotsAt()
    expect(dots.map((d) => d.getAttribute('aria-label'))).toEqual(['Слайд 1 из 3', 'Слайд 2 из 3', 'Слайд 3 из 3'])
    expect(dots.map((d) => d.getAttribute('aria-current'))).toEqual(['true', null, null])
    document.querySelector<HTMLElement>('[data-carousel-next]')!.click()
    await new Promise((r) => setTimeout(r, 20))
    expect(dotsAt().map((d) => d.getAttribute('aria-current'))).toEqual([null, 'true', null])
  })

  it('узбекская и неизвестная страница: свои подписи / английский', async () => {
    document.documentElement.setAttribute('lang', 'uz')
    await boot(buildBody(2))
    expect(dotsAt()[1].getAttribute('aria-label')).toBe('Slayd 2 / 2')
    document.body.innerHTML = ''
    document.documentElement.setAttribute('lang', 'kz')
    await boot(buildBody(2))
    expect(dotsAt()[0].getAttribute('aria-label')).toBe('Slide 1 of 2')
  })

  it('подпись автора не перезаписывается', async () => {
    await boot(buildBody(2).replace('data-element-id="dot-1"', 'data-element-id="dot-1" aria-label="Второй кадр"'))
    expect(dotsAt()[1].getAttribute('aria-label')).toBe('Второй кадр')
  })
})
