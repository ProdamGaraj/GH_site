/**
 * @jest-environment jsdom
 *
 * Модалка планировки в браузере: содержимое берётся из карточки квартиры.
 * Карточки бывают в вёрстке дизайна (цена — текст перед старой ценой) и в
 * вёрстке CMS (цена во вложенном <span>, первым узлом — перенос строки).
 */
import { generateComplexOverlays } from '../services/ComplexOverlaysRuntime'

function mount(card: string, lang = 'ru') {
  const cards = `<div class="apartments-grid">${card}</div>`
  const out = generateComplexOverlays(cards, lang)
  const script = out.slice(out.indexOf('<script>') + 8, out.lastIndexOf('</script>'))
  document.body.innerHTML = cards + out.slice(0, out.indexOf('<script>'))
  // eslint-disable-next-line no-new-func
  new Function(script)()
  const el = document.querySelector('.apartment-card') as HTMLElement
  ;(window as any).ghPlanModal.open(el)
  return (id: string) => document.getElementById(id)!.textContent
}

afterEach(() => {
  document.body.innerHTML = ''
  delete (window as any).ghPlanModal
  delete (window as any).ghLightbox
})

it('карточка CMS: цена из вложенного span, перенос строки перед ним не мешает', () => {
  const text = mount(`
    <article class="apartment-card">
      <h3>1-комн. 34.87 м²</h3>
      <div class="apartment-price">
        <span>от 376 511 429 UZS</span>
      </div>
    </article>`)
  expect(text('planModalPrice')).toBe('от 376 511 429 UZS')
  expect(text('planModalTitle')).toBe('1-комн. 34.87 м²')
})

it('карточка дизайна: цена — текст перед старой ценой, старая не попадает', () => {
  const text = mount(`
    <article class="apartment-card">
      <h3>4-комн. 114 м²</h3>
      <div class="apartment-price">1 354 320 000 UZS <small>1 539 000 000 UZS</small></div>
    </article>`)
  expect(text('planModalPrice')).toBe('1 354 320 000 UZS')
})

it('цены нет или она пустая — «Цена по запросу», а не пустое место', () => {
  expect(mount('<article class="apartment-card"><h3>A</h3><div class="apartment-price">  <span> </span> </div></article>')('planModalPrice'))
    .toBe('Цена по запросу')
  expect(mount('<article class="apartment-card"><h3>A</h3></article>', 'uz')('planModalPrice'))
    .toBe('Narx so‘rov bo‘yicha')
})
