/**
 * @jest-environment jsdom
 *
 * Лайтбокс галерей холлов и двора (v3) в браузере: только фото, привязка к
 * карточке один раз, на видеослайде не открывается.
 */
import { LIGHTBOX_JS } from '../scripts/complexMedia'

const run = () => new Function(LIGHTBOX_JS)()

afterEach(() => {
  document.body.innerHTML = ''
  delete (window as any).ghLightbox
})

function mount(slides: string, withExpand = true): jest.Mock {
  document.body.innerHTML = `
    <div class="media-card" data-carousel="true" id="hallMedia">
      <div data-carousel-track="true">${slides}</div>
      ${withExpand ? '<button class="expand-button">⛶</button>' : ''}
      <button class="side-arrow right" data-carousel-next="true">›</button>
    </div>`
  const open = jest.fn()
  ;(window as any).ghLightbox = { open }
  return open
}

const photo = (url: string, active = false) =>
  `<div data-carousel-slide="true" data-slide-video="" class="${active ? 'is-active' : ''}" style="background-image: url('${url}')"></div>`
const video = (url: string, poster: string, active = false) =>
  `<div data-carousel-slide="true" data-slide-video="${url}" class="${active ? 'is-active' : ''}" style="background-image: url('${poster}')"></div>`

const expand = () => (document.querySelector('.expand-button') as HTMLButtonElement).click()

it('две копии скрипта (холлы и двор) — клик открывает лайтбокс один раз', () => {
  const open = mount(photo('/a.webp') + photo('/b.webp', true))
  run()
  run()
  expand()
  expect(open).toHaveBeenCalledTimes(1)
  expect(open).toHaveBeenCalledWith(['/a.webp', '/b.webp'], 1)
})

it('в лайтбокс идут только фото, индекс — среди фото', () => {
  const open = mount(video('/v.mp4', '/a.webp') + photo('/a.webp') + photo('/b.webp', true))
  run()
  expand()
  expect(open).toHaveBeenCalledWith(['/a.webp', '/b.webp'], 1)
})

it('на видеослайде лайтбокс не открывается', () => {
  const open = mount(video('/v.mp4', '/a.webp', true) + photo('/a.webp'))
  run()
  expand()
  expect(open).not.toHaveBeenCalled()
})

it('стрелка листает карусель и лайтбокс не открывает', () => {
  const open = mount(photo('/a.webp', true) + photo('/b.webp'))
  run()
  ;(document.querySelector('.side-arrow') as HTMLButtonElement).click()
  expect(open).not.toHaveBeenCalled()
})

it('карточка без кнопки «развернуть» («О проекте») не привязывается', () => {
  const open = mount(photo('/a.webp', true), false)
  run()
  ;(document.querySelector('.media-card') as HTMLElement).click()
  expect(open).not.toHaveBeenCalled()
  expect(document.querySelector('.media-card')!.hasAttribute('data-lightbox-bound')).toBe(false)
})
