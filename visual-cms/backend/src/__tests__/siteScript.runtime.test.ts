/**
 * @jest-environment jsdom
 *
 * Общий скрипт сайта (Site JS) в браузере: плавающих окон нет, формы не
 * трогает, события и дорожная карта работают.
 */
import * as fs from 'fs'
import * as path from 'path'

const RUNTIME = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'assets', 'site-runtime.js'), 'utf8')

function boot(body = '', head = ''): void {
  document.head.innerHTML = head
  document.body.innerHTML = body
  // Скрипт стоит в конце <body>, DOM к этому моменту разобран.
  new Function(RUNTIME)()
}

const count = (sel: string) => document.querySelectorAll(sel).length

beforeEach(() => {
  jest.useFakeTimers()
  localStorage.clear()
  sessionStorage.clear()
  ;(window as any).dataLayer = []
})

afterEach(() => {
  jest.useRealTimers()
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  document.body.className = ''
  document.documentElement.removeAttribute('lang')
})

describe('плавающих окон нет (v4: на сайте только кнопка контактов — блок CMS)', () => {
  const FLOATING = ['.chat-widget', '.chat-button', '.promo-popup', '.exit-popup', '.consult-backdrop', '#gh-widget-style']

  it('при загрузке и спустя время ничего не всплывает', () => {
    boot()
    jest.advanceTimersByTime(120000)
    for (const sel of FLOATING) expect(count(sel)).toBe(0)
    expect(sessionStorage.getItem('promoPopupShown')).toBeNull()
  })

  it('ни прокрутка, ни уход курсора вверх окон не открывают', () => {
    boot()
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 3000 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 2500 })
    window.dispatchEvent(new Event('scroll'))
    document.dispatchEvent(new MouseEvent('mouseleave', { clientY: 0 }))
    for (const sel of FLOATING) expect(count(sel)).toBe(0)
  })

  it('кнопку контактов на странице не трогает и не прячет', () => {
    boot('<div class="contact-widget"><button class="contact-widget-button">Контакты</button></div>')
    expect(count('.contact-widget-button')).toBe(1)
    expect((document.querySelector('.contact-widget') as HTMLElement).style.display).toBe('')
  })

  it('в коде нет ни текстов, ни функций окон', () => {
    for (const gone of ['injectSupportWidgets', 'Чат-бот', 'Не уходите без консультации', 'promo-popup', 'exit-popup',
      'consult-backdrop', 'closeGoldenHousePopups']) {
      // Шапка-комментарий рассказывает, что убрано, — проверяем только код.
      expect(RUNTIME.slice(RUNTIME.indexOf('*/') + 2)).not.toContain(gone)
    }
  })
})

describe('формы и события', () => {
  it('формы не обрабатывает и заявки в браузере не хранит (v3: этим занят рантайм заявок)', () => {
    boot('<form><input name="phone" value="+998901234567"><button type="submit">Отправить</button></form>')
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    ;(document.querySelector('form button') as HTMLButtonElement).dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
    expect(localStorage.getItem('goldenHouseLeads')).toBeNull()
    expect(document.querySelector('form button')!.textContent).toBe('Отправить')
  })

  it('просмотр страницы уходит в dataLayer один раз', () => {
    boot()
    const views = ((window as any).dataLayer as Array<{ event: string }>).filter((e) => e.event === 'page_view')
    expect(views).toHaveLength(1)
  })

  it('в событии — адрес страницы и язык (раньше page был «index.html» на всех страницах)', () => {
    window.history.pushState({}, '', '/uz/about/')
    document.documentElement.setAttribute('lang', 'uz')
    boot()
    const view = ((window as any).dataLayer as Array<{ event: string; page: string; lang: string }>).find((e) => e.event === 'page_view')!
    expect(view.page).toBe('/uz/about/')
    expect(view.lang).toBe('uz')
    window.history.pushState({}, '', '/')
  })

  it('без дорожной карты на странице её код ничего не делает и не падает', () => {
    expect(() => boot('<main></main>')).not.toThrow()
  })
})

describe('чего в Site JS нет', () => {
  it('не объявляет контраст логотипа — им владеет блок Navigation', () => {
    ;(window as any).syncLogoContrast = 'navigation'
    boot()
    expect((window as any).syncLogoContrast).toBe('navigation')
    delete (window as any).syncLogoContrast
  })
})
