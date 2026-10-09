/**
 * @jest-environment jsdom
 *
 * Общий скрипт сайта (Site JS) в браузере: виджеты создаются один раз,
 * выключатель страницы работает, формы ведут себя как до сведения.
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

const promoVisible = () => document.querySelector('.promo-popup')!.classList.contains('is-visible')

/** Высота страницы и прокрутка для jsdom (сам он раскладку не считает). */
function scrollTo(y: number, pageHeight = 3000): void {
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: pageHeight })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y })
  window.dispatchEvent(new Event('scroll'))
}

describe('виджеты', () => {
  it('чат, окно консультации и промо-окно — по одному', () => {
    boot()
    expect(count('.chat-widget')).toBe(1)
    expect(count('.consult-backdrop')).toBe(1)
    expect(count('.promo-popup')).toBe(1)
  })

  it('промо-окно — через 35 с, не сразу', () => {
    boot()
    jest.advanceTimersByTime(34000)
    expect(promoVisible()).toBe(false)
    jest.advanceTimersByTime(1000)
    expect(promoVisible()).toBe(true)
  })

  it('промо-окно — раньше, если прокрутили половину страницы', () => {
    boot()
    scrollTo(1000) // прокручиваемо 2200, половина — 1100
    expect(promoVisible()).toBe(false)
    scrollTo(1100)
    expect(promoVisible()).toBe(true)
  })

  it('показанное промо-окно больше в этой сессии не появляется (даже если его не нажимали)', () => {
    boot()
    jest.advanceTimersByTime(35000)
    expect(sessionStorage.getItem('promoPopupShown')).toBe('true')
    document.body.innerHTML = ''
    boot()
    expect(count('.promo-popup')).toBe(0)
  })

  it('при открытом меню промо-окно ждёт: не показывается и не тратит показ', () => {
    boot()
    document.body.classList.add('gnav-menu-open')
    jest.advanceTimersByTime(35000)
    expect(promoVisible()).toBe(false)
    expect(sessionStorage.getItem('promoPopupShown')).toBeNull()
    document.body.classList.remove('gnav-menu-open')
    scrollTo(2000)
    expect(promoVisible()).toBe(true)
  })

  it('чат прячется при открытом меню и окне консультации (стиль), на телефоне — круглая кнопка', () => {
    boot()
    const css = document.querySelector('#gh-widget-style')!.textContent!
    expect(css).toContain('body.gnav-menu-open .chat-widget')
    expect(css).toContain('body:has(.consult-backdrop.is-open) .chat-widget')
    expect(css).toMatch(/max-width:680px\)\{[^@]*\.chat-button\{width:52px;height:52px/)
    expect(document.querySelector('.chat-button .chat-label')!.textContent).toBe('Чат-бот')
  })

  it('выключатель страницы убирает плавающие окна, окно консультации остаётся для кнопок', () => {
    boot('<button data-consult-trigger>Консультация</button>', '<meta name="gh-widgets" content="off">')
    expect(count('.chat-widget')).toBe(0)
    expect(count('.promo-popup')).toBe(0)
    expect(count('.consult-backdrop')).toBe(1)
    ;(document.querySelector('[data-consult-trigger]') as HTMLButtonElement).click()
    expect(document.querySelector('.consult-backdrop')!.classList.contains('is-open')).toBe(true)
  })

  it('выключатель без учёта регистра и пробелов; другое значение — окна на месте', () => {
    boot('', '<meta name="gh-widgets" content=" OFF ">')
    expect(count('.chat-widget')).toBe(0)
    document.body.innerHTML = ''
    boot('', '<meta name="gh-widgets" content="on">')
    expect(count('.chat-widget')).toBe(1)
  })

})

describe('тексты на языке страницы', () => {
  it('узбекская страница — окна по-узбекски', () => {
    document.documentElement.setAttribute('lang', 'uz')
    boot()
    expect(document.querySelector('.chat-panel h3')!.textContent).toBe('Onlayn maslahat')
    expect(document.querySelector('#consultTitle')!.textContent).toBe('Maslahat olish')
    expect(document.querySelector('.consult-submit')!.textContent).toBe('Yuborish')
    expect(document.querySelector('.promo-popup .popup-close')!.textContent).toBe('Keyinroq')
    expect(document.body.innerHTML).not.toMatch(/[А-Яа-яЁё]{3,}/)
  })

  it('английская — по-английски; неизвестный язык — основной (русский)', () => {
    document.documentElement.setAttribute('lang', 'en-US')
    boot()
    expect(document.querySelector('.popup-label')!.textContent).toBe('families with us')
    document.body.innerHTML = ''
    document.documentElement.setAttribute('lang', 'kz')
    boot()
    expect(document.querySelector('.popup-label')!.textContent).toBe('семей с нами')
  })

  it('окно консультации после отправки — «Заявка отправлена» (без опечатки)', () => {
    boot('<button data-consult-trigger>Консультация</button>')
    ;(document.querySelector('[data-consult-trigger]') as HTMLButtonElement).click()
    const form = document.querySelector('.consult-form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { cancelable: true }))
    expect(document.querySelector('.consult-submit')!.textContent).toBe('Заявка отправлена')
  })
})

describe('формы и события', () => {
  it('формы ведут себя как до сведения: заявка сохраняется в браузере (временно)', () => {
    boot('<form><input name="phone" value="+998901234567"><button type="submit">Отправить</button></form>')
    ;(document.querySelector('form button') as HTMLButtonElement).click()
    const leads = JSON.parse(localStorage.getItem('goldenHouseLeads') || '[]')
    expect(leads).toHaveLength(1)
    expect(leads[0].fields.phone).toBe('+998901234567')
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
