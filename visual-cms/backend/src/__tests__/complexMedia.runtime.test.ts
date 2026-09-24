/**
 * @jest-environment jsdom
 *
 * Скрипты медиаблоков страницы проекта в браузере: автозапуск видео «О проекте»
 * и однократная привязка лайтбокса галерей.
 */
import { ABOUT_JS, LIGHTBOX_JS } from '../scripts/complexMedia'

const run = (js: string) => new Function(js)()

afterEach(() => {
  document.body.innerHTML = ''
  delete (window as any).ghLightbox
  delete (window as any).IntersectionObserver
})

describe('видео «О проекте»', () => {
  function mountVideo(): HTMLVideoElement {
    document.body.innerHTML = '<div id="aboutMedia"><video data-autoplay-visible="true" src="/a.mp4"></video></div>'
    const video = document.querySelector('video') as HTMLVideoElement
    video.play = jest.fn().mockResolvedValue(undefined)
    video.pause = jest.fn()
    return video
  }

  it('играет, когда карточка на экране, и встаёт на паузу, когда уходит', () => {
    const video = mountVideo()
    let callback: (entries: Array<{ isIntersecting: boolean }>) => void = () => {}
    ;(window as any).IntersectionObserver = class {
      constructor(cb: typeof callback) {
        callback = cb
      }
      observe() {}
    }
    run(ABOUT_JS)
    expect(video.muted).toBe(true)
    callback([{ isIntersecting: true }])
    expect(video.play).toHaveBeenCalledTimes(1)
    callback([{ isIntersecting: false }])
    expect(video.pause).toHaveBeenCalledTimes(1)
  })

  it('без IntersectionObserver просто запускается', () => {
    const video = mountVideo()
    run(ABOUT_JS)
    expect(video.play).toHaveBeenCalledTimes(1)
  })

  it('отказ браузера в автозапуске не роняет страницу', () => {
    const video = mountVideo()
    video.play = jest.fn().mockRejectedValue(new Error('NotAllowedError'))
    expect(() => run(ABOUT_JS)).not.toThrow()
  })

  it('видео без data-autoplay-visible не трогается — поведение выключается в редакторе', () => {
    document.body.innerHTML = '<video src="/a.mp4"></video>'
    const video = document.querySelector('video') as HTMLVideoElement
    video.play = jest.fn()
    run(ABOUT_JS)
    expect(video.play).not.toHaveBeenCalled()
  })
})

describe('лайтбокс галерей', () => {
  function mountGallery(): void {
    document.body.innerHTML = `
      <div class="media-card" data-carousel="true" id="hallMedia">
        <div data-carousel-track="true">
          <div data-carousel-slide="true" style="background-image: url('/a.webp')"></div>
          <div data-carousel-slide="true" class="is-active" style="background-image: url('/b.webp')"></div>
        </div>
        <button class="expand-button">⛶</button>
        <button class="side-arrow right" data-carousel-next="true">›</button>
      </div>`
  }

  it('две копии скрипта (холлы и двор) — клик открывает лайтбокс один раз', () => {
    mountGallery()
    const open = jest.fn()
    ;(window as any).ghLightbox = { open }
    run(LIGHTBOX_JS)
    run(LIGHTBOX_JS)
    ;(document.querySelector('.expand-button') as HTMLButtonElement).click()
    expect(open).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith(['/a.webp', '/b.webp'], 1)
  })

  it('стрелка листает карусель и лайтбокс не открывает', () => {
    mountGallery()
    const open = jest.fn()
    ;(window as any).ghLightbox = { open }
    run(LIGHTBOX_JS)
    ;(document.querySelector('.side-arrow') as HTMLButtonElement).click()
    expect(open).not.toHaveBeenCalled()
  })
})
