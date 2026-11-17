/**
 * @jest-environment jsdom
 *
 * Заявка из окна планировки: форма видна сразу, без кнопки «Получить
 * консультацию» (раньше та листала к общей форме, потом раскрывала форму).
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
const form = () => lead().querySelector('form') as HTMLFormElement
const cards = () => Array.from(document.querySelectorAll('.apartment-card')) as HTMLElement[]

afterEach(cleanup)

describe('форма заявки в окне планировки', () => {
  it('в разметке: форма вида plan с именем и телефоном, видна сразу; стили формы рядом', () => {
    expect(generateComplexOverlays(CARD('p1', 'x'), 'ru')).toContain('data-plan-lead')
    mount()
    expect(form().getAttribute('data-lead-kind')).toBe('plan')
    expect(form().querySelector('input[name="name"]')).not.toBeNull()
    expect((form().querySelector('input[name="phone"]') as HTMLInputElement).type).toBe('tel')
    expect(form().querySelector('button[type="submit"]')!.textContent).toBe('Отправить заявку')
    expect(lead().hidden).toBe(false)
  })

  it('кнопки «Получить консультацию» нет ни на одном языке', () => {
    for (const lang of ['ru', 'uz', 'en']) {
      const out = generateComplexOverlays(CARD('p1', 'x'), lang)
      expect(out).not.toContain('Получить консультацию')
      expect(out).not.toContain('Maslahat olish')
      expect(out).not.toContain('Get a consultation')
    }
    mount()
    // Единственная кнопка с классом CTA — отправка формы (стиль из CSS блока).
    const ctas = Array.from(document.querySelectorAll('.plan-modal-cta'))
    expect(ctas).toHaveLength(1)
    expect(ctas[0].getAttribute('type')).toBe('submit')
  })

  it('current() — карточка, по которой открыто окно', () => {
    mount()
    expect((window as any).ghPlanModal.current()).toBeNull()
    cards()[1].click()
    expect((window as any).ghPlanModal.current()).toBe(cards()[1])
    ;(window as any).ghPlanModal.open(cards()[0])
    expect((window as any).ghPlanModal.current()).toBe(cards()[0])
  })

  it('открытие планировки сбрасывает форму (reset — по нему рантайм заявок применяет память), статус стёрт', () => {
    mount()
    ;(window as any).ghPlanModal.open(cards()[0])
    const phone = form().querySelector('input[name="phone"]') as HTMLInputElement
    phone.value = '901234567'
    const status = document.createElement('p')
    status.className = 'gh-lead-extra gh-lead-status is-error'
    status.textContent = 'Проверьте номер'
    form().appendChild(status)
    const resets = jest.fn()
    form().addEventListener('reset', resets)

    ;(window as any).ghPlanModal.open(cards()[1])
    expect(resets).toHaveBeenCalledTimes(1)
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
    const input = form().querySelector('input[name="name"]')!
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
    expect(form().querySelector('button[type="submit"]')!.textContent).toBe(submit)
    expect(form().querySelector('input[name="name"]')!.getAttribute('placeholder')).toBe(overlayLabels(lang).leadName)
  })
})
