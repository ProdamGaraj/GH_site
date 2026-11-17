/**
 * @jest-environment jsdom
 *
 * Заявка из окна планировки: «Получить консультацию» раскрывает форму в окне
 * (раньше закрывала окно и листала к общей форме — планировка терялась).
 */
import { generateComplexOverlays, overlayLabels } from '../services/ComplexOverlaysRuntime'

const CARD = (id: string, title: string) => `
  <article class="apartment-card" data-plan-type="${id}" data-deadline="">
    <h3>${title}</h3><span data-card-project="">Dostlik</span>
  </article>`

function runtimeOf(out: string): string {
  return out.slice(out.indexOf('<script>') + 8, out.lastIndexOf('</script>'))
}

function mount(lang = 'ru'): void {
  const cards = `<section id="choice">${CARD('p1', '2-комн.')}${CARD('p2', 'Студия')}</section><section id="lead"></section>`
  const out = generateComplexOverlays(cards, lang)
  document.body.innerHTML = cards + out.slice(0, out.indexOf('<script>'))
  // eslint-disable-next-line no-new-func
  new Function(runtimeOf(out))()
}

function cleanup(): void {
  document.body.innerHTML = ''
  delete (window as any).ghPlanModal
  delete (window as any).ghLightbox
}

const lead = () => document.getElementById('planModalLead') as HTMLElement
const cta = () => document.querySelector('.plan-modal-cta') as HTMLButtonElement
const cards = () => Array.from(document.querySelectorAll('.apartment-card')) as HTMLElement[]

afterEach(cleanup)

describe('форма заявки в окне планировки', () => {
  it('в разметке: форма вида plan с именем и телефоном, свёрнута; стили формы рядом', () => {
    expect(generateComplexOverlays(CARD('p1', 'x'), 'ru')).toContain('data-plan-lead')
    mount()
    const form = lead().querySelector('form') as HTMLFormElement
    expect(form.getAttribute('data-lead-kind')).toBe('plan')
    expect(form.querySelector('input[name="name"]')).not.toBeNull()
    expect((form.querySelector('input[name="phone"]') as HTMLInputElement).type).toBe('tel')
    expect(form.querySelector('button[type="submit"]')!.textContent).toBe('Отправить заявку')
    expect(lead().hidden).toBe(true)
  })

  it('«Получить консультацию» раскрывает форму, прячет кнопку и не листает страницу', () => {
    mount()
    const scroll = jest.fn()
    ;(document.getElementById('lead') as any).scrollIntoView = scroll
    ;(window as any).ghPlanModal.open(cards()[0])
    cta().click()
    expect(lead().hidden).toBe(false)
    expect(cta().style.display).toBe('none')
    expect(document.activeElement).toBe(lead().querySelector('input[name="name"]'))
    expect(document.getElementById('planModal')!.classList.contains('is-open')).toBe(true)
    expect(scroll).not.toHaveBeenCalled()
  })

  it('current() — карточка, по которой открыто окно', () => {
    mount()
    expect((window as any).ghPlanModal.current()).toBeNull()
    cards()[1].click()
    expect((window as any).ghPlanModal.current()).toBe(cards()[1])
    ;(window as any).ghPlanModal.open(cards()[0])
    expect((window as any).ghPlanModal.current()).toBe(cards()[0])
  })

  it('следующая планировка открывается с кнопкой, форма свёрнута и очищена, статус стёрт', () => {
    mount()
    ;(window as any).ghPlanModal.open(cards()[0])
    cta().click()
    const phone = lead().querySelector('input[name="phone"]') as HTMLInputElement
    phone.value = '901234567'
    const status = document.createElement('p')
    status.className = 'gh-lead-extra gh-lead-status is-error'
    status.textContent = 'Проверьте номер'
    lead().appendChild(status)

    ;(window as any).ghPlanModal.open(cards()[1])
    expect(lead().hidden).toBe(true)
    expect(cta().style.display).toBe('')
    expect(phone.value).toBe('')
    expect(status.textContent).toBe('')
    expect(status.classList.contains('is-error')).toBe(false)
  })

  it('стрелки в поле формы не листают ракурсы', () => {
    mount()
    const card = cards()[0]
    card.setAttribute('data-plan-images', '/a.webp|/b.webp')
    ;(window as any).ghPlanModal.open(card)
    const media = document.getElementById('planModalMedia')!
    cta().click()
    const input = lead().querySelector('input[name="name"]')!
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(media.style.getPropertyValue('--modal-image')).toContain('/a.webp')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(media.style.getPropertyValue('--modal-image')).toContain('/b.webp')
  })

  it.each([
    ['uz', 'Ariza yuborish'],
    ['en', 'Send request'],
  ])('подписи формы на языке страницы: %s', (lang, submit) => {
    mount(lang)
    expect(lead().querySelector('button[type="submit"]')!.textContent).toBe(submit)
    expect(lead().querySelector('input[name="name"]')!.getAttribute('placeholder')).toBe(overlayLabels(lang).leadName)
  })

  it('старая разметка без формы — кнопка по-прежнему ведёт к форме страницы', () => {
    mount()
    lead().remove()
    // Рантайм ищет форму при запуске — перезапускаем на разметке без неё.
    // eslint-disable-next-line no-new-func
    new Function(runtimeOf(generateComplexOverlays(CARD('p1', 'x'), 'ru')))()
    const scroll = jest.fn()
    ;(document.getElementById('lead') as any).scrollIntoView = scroll
    ;(window as any).ghPlanModal.open(cards()[0])
    cta().click()
    expect(scroll).toHaveBeenCalled()
    expect(document.getElementById('planModal')!.classList.contains('is-open')).toBe(false)
  })
})
