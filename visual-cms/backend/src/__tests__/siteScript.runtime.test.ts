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
})

describe('виджеты', () => {
  it('чат, окно консультации и промо-окно — по одному', () => {
    boot()
    expect(count('.chat-widget')).toBe(1)
    expect(count('.consult-backdrop')).toBe(1)
    expect(count('.promo-popup')).toBe(1)
  })

  it('промо-окно показывается через паузу', () => {
    boot()
    expect(document.querySelector('.promo-popup')!.classList.contains('is-visible')).toBe(false)
    jest.advanceTimersByTime(1300)
    expect(document.querySelector('.promo-popup')!.classList.contains('is-visible')).toBe(true)
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
