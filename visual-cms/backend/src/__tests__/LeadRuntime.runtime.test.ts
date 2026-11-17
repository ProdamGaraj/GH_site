/**
 * @jest-environment jsdom
 *
 * Рантайм заявок в браузере: какие формы считаются заявками, что уходит в
 * POST /api/leads, путь клиента по сайту и поведение при ошибках и в превью.
 */
import { generateLeadRuntime, JOURNEY_KEY, leadLabels } from '../services/LeadRuntime'

type FetchMock = jest.Mock<Promise<{ ok: boolean; status: number }>, [string, RequestInit]>

let fetchMock: FetchMock

function run(lang = 'ru', live = true): void {
  const out = generateLeadRuntime(lang, live)
  const script = out.slice(out.indexOf('<script>') + 8, out.lastIndexOf('</script>'))
  // eslint-disable-next-line no-new-func
  new Function(script)()
}

function mount(body: string, { lang = 'ru', live = true } = {}): void {
  document.documentElement.setAttribute('lang', lang)
  document.body.innerHTML = body
  run(lang, live)
}

/** Дать отработать цепочке промисов fetch → then. */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

function sent(): Record<string, any> {
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/leads')
  expect(init.method).toBe('POST')
  return JSON.parse(String(init.body))
}

const statusOf = (form: Element) => (form.querySelector('.gh-lead-status') as HTMLElement).textContent
const journey = () => JSON.parse(localStorage.getItem(JOURNEY_KEY) || '{}')

const CALLBACK = `
  <form class="lead-form">
    <input name="name" type="text">
    <input name="phone" type="tel">
    <button type="submit" class="submit">Получить консультацию</button>
  </form>`

function fill(form: HTMLFormElement, values: Record<string, string>): void {
  for (const [name, value] of Object.entries(values)) {
    ;(form.querySelector(`[name="${name}"]`) as HTMLInputElement).value = value
  }
}

function click(el: Element): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true })
  el.dispatchEvent(event)
  return event
}

/**
 * Обработчики, повешенные рантаймом на document/window. На странице рантайм
 * один, а в тестах его запускают заново — без снятия старые экземпляры
 * ловили бы клики следующих тестов.
 */
const added: Array<[EventTarget, string, EventListenerOrEventListenerObject, unknown]> = []
const originalAdd = EventTarget.prototype.addEventListener

beforeAll(() => {
  EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, listener: any, options?: any) {
    if (this === document || this === window) added.push([this, type, listener, options])
    return originalAdd.call(this, type, listener, options)
  }
})

afterAll(() => {
  EventTarget.prototype.addEventListener = originalAdd
})

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-11-17T10:00:00Z'))
  localStorage.clear()
  delete (window as any).__ghLeads
  delete (window as any).ghPlanModal
  ;(window as any).dataLayer = []
  fetchMock = jest.fn(async (_url: string, _init: RequestInit) => ({ ok: true, status: 201 })) as FetchMock
  ;(window as any).fetch = fetchMock
  window.history.replaceState({}, '', '/ru/')
})

afterEach(() => {
  jest.useRealTimers()
  document.body.innerHTML = ''
  for (const [target, type, listener, options] of added.splice(0)) {
    target.removeEventListener(type, listener, options as boolean | EventListenerOptions | undefined)
  }
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})

describe('оформление форм', () => {
  it('в конце формы с телефоном — статус и согласие (внутри формы: сетка секции цела), ловушка', () => {
    mount(CALLBACK)
    const form = document.querySelector('form')!
    const tail = Array.from(form.children).slice(-2)
    expect(tail[0].className).toContain('gh-lead-status')
    expect(tail[1].textContent).toBe(leadLabels('ru').consent)
    expect(form.nextElementSibling).toBeNull()
    const hp = form.querySelector('input[name="website"]') as HTMLInputElement
    expect(hp.tabIndex).toBe(-1)
    expect(hp.className).toBe('gh-lead-hp')
  })

  it('согласие на языке страницы', () => {
    mount(CALLBACK, { lang: 'uz' })
    expect(document.querySelector('.gh-lead-consent')!.textContent).toContain('rozilik')
    document.body.innerHTML = ''
    delete (window as any).__ghLeads
    mount(CALLBACK, { lang: 'en' })
    expect(document.querySelector('.gh-lead-consent')!.textContent).toContain('you agree')
  })

  it('форма без телефона (калькулятор ипотеки) — не заявка: не трогаем и не отправляем', () => {
    mount('<form><input placeholder="Стоимость"><button type="button" class="submit">Рассчитать</button></form>')
    expect(document.querySelector('.gh-lead-consent')).toBeNull()
    const event = click(document.querySelector('button')!)
    expect(event.defaultPrevented).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('форму, дорисованную скриптом, оформляет при первом фокусе', () => {
    mount('<main></main>')
    document.body.insertAdjacentHTML('beforeend', CALLBACK)
    const phone = document.querySelector('input[name="phone"]') as HTMLInputElement
    phone.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(document.querySelectorAll('.gh-lead-consent')).toHaveLength(1)
    phone.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(document.querySelectorAll('.gh-lead-consent')).toHaveLength(1)
  })

  it('повторный запуск скрипта не дублирует обработчики и строки', () => {
    mount(CALLBACK)
    run()
    expect(document.querySelectorAll('.gh-lead-consent')).toHaveLength(1)
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    click(form.querySelector('button')!)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('отправка', () => {
  it('обратный звонок: вид, форма, страница, согласие; кнопка и статус', async () => {
    document.title = 'Golden House'
    mount(CALLBACK)
    const form = document.querySelector('form')!
    fill(form, { name: 'Иван', phone: '+998 90 123 45 67' })
    const event = click(form.querySelector('button')!)
    expect(event.defaultPrevented).toBe(true)

    const body = sent()
    expect(body).toMatchObject({
      kind: 'callback',
      name: 'Иван',
      phone: '+998 90 123 45 67',
      form: 'Обратный звонок',
      page: { path: '/ru/', title: 'Golden House', lang: 'ru' },
      consent: true,
      hp: '',
    })
    expect(body).not.toHaveProperty('email')
    expect(body).not.toHaveProperty('plan')
    expect(form.querySelector('button')!.textContent).toBe(leadLabels('ru').sending)

    await flush()
    expect(form.querySelector('button')!.textContent).toBe('Заявка отправлена')
    expect((form.querySelector('button') as HTMLButtonElement).disabled).toBe(true)
    expect(statusOf(form)).toBe(leadLabels('ru').thanks)
    expect((form.querySelector('[name="phone"]') as HTMLInputElement).value).toBe('')
    expect((window as any).dataLayer).toContainEqual({ event: 'lead_sent', leadKind: 'callback', page: '/ru/' })

    jest.advanceTimersByTime(4000)
    expect(form.querySelector('button')!.textContent).toBe('Получить консультацию')
    expect((form.querySelector('button') as HTMLButtonElement).disabled).toBe(false)
  })

  it('форма проекта: вид project и выбранный проект в полях', () => {
    mount(`
      <form class="lead-form">
        <input name="name"><input name="phone" type="tel">
        <select name="project"><option id="leadProject"> Assalom Do'stlik </option></select>
        <button type="submit">Отправить</button>
      </form>`)
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    click(form.querySelector('button')!)
    expect(sent()).toMatchObject({ kind: 'project', form: 'Форма на странице проекта', fields: { project: "Assalom Do'stlik" } })
  })

  it('кнопка type="button" (форма «Коммерции») тоже отправляет; тип объекта — в полях', () => {
    mount(`
      <form class="commerce-form">
        <input name="name"><input name="phone" type="tel">
        <select name="object"><option>Офис</option></select>
        <button type="button" class="commerce-submit">Отправить</button>
      </form>`)
    fill(document.querySelector('form')!, { phone: '901234567' })
    click(document.querySelector('button')!)
    expect(sent()).toMatchObject({ kind: 'callback', form: 'Форма «Коммерция»', fields: { object: 'Офис' } })
  })

  it('форма с вопросом: message отдельно от полей', () => {
    mount(`
      <form><input name="name"><input name="phone"><textarea name="message"></textarea>
      <button type="button" class="submit">Отправить</button></form>`)
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567', message: 'Есть рассрочка?' })
    click(form.querySelector('button')!)
    const body = sent()
    expect(body.message).toBe('Есть рассрочка?')
    expect(body.form).toBe('Форма с вопросом')
    expect(body.fields).toEqual({})
  })

  it('Enter в поле (submit) отправляет один раз', () => {
    mount(CALLBACK)
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    const submit = new Event('submit', { bubbles: true, cancelable: true })
    form.dispatchEvent(submit)
    expect(submit.defaultPrevented).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('пока заявка в пути, повторный клик не шлёт вторую', () => {
    fetchMock.mockImplementation(() => new Promise(() => undefined))
    mount(CALLBACK)
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    click(form.querySelector('button')!)
    click(form.querySelector('button')!)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('короткий телефон — без запроса, ошибка и фокус в поле', () => {
    mount(CALLBACK)
    const form = document.querySelector('form')!
    fill(form, { phone: '12-34' })
    click(form.querySelector('button')!)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(statusOf(form)).toBe(leadLabels('ru').phoneError)
    expect(document.activeElement).toBe(form.querySelector('[name="phone"]'))
  })

  it.each([
    [429, 'tooMany'],
    [400, 'phoneError'],
    [500, 'error'],
  ] as const)('ответ %i — сообщение, данные формы остаются, кнопку можно нажать снова', async (status, key) => {
    fetchMock.mockResolvedValue({ ok: false, status })
    mount(CALLBACK)
    const form = document.querySelector('form')!
    fill(form, { name: 'Иван', phone: '901234567' })
    click(form.querySelector('button')!)
    await flush()
    expect(statusOf(form)).toBe(leadLabels('ru')[key])
    expect((form.querySelector('[name="name"]') as HTMLInputElement).value).toBe('Иван')
    expect(form.querySelector('button')!.textContent).toBe('Получить консультацию')
    expect((form.querySelector('button') as HTMLButtonElement).disabled).toBe(false)
  })

  it('сеть недоступна — общее сообщение об ошибке', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    mount(CALLBACK)
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    click(form.querySelector('button')!)
    await flush()
    expect(statusOf(form)).toBe(leadLabels('ru').error)
  })

  it('сброс формы стирает старый статус', async () => {
    mount(CALLBACK)
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    click(form.querySelector('button')!)
    await flush()
    expect(statusOf(form)).toBe(leadLabels('ru').thanks)
    form.reset()
    expect(statusOf(form)).toBe('')
  })
})

describe('превью CMS', () => {
  it('заявка не отправляется, путь не пишется, форма говорит «предпросмотр»', () => {
    mount(CALLBACK, { live: false })
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    click(form.querySelector('button')!)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(statusOf(form)).toBe(leadLabels('ru').preview)
    expect(localStorage.getItem(JOURNEY_KEY)).toBeNull()
  })
})

describe('путь клиента', () => {
  it('визит, первая дата, внешний источник и метки кампании', () => {
    Object.defineProperty(document, 'referrer', { configurable: true, value: 'https://www.google.com/search?q=gh' })
    window.history.replaceState({}, '', '/ru/?utm_source=yandex&utm_medium=cpc&utm_campaign=spring')
    document.title = 'Главная'
    mount('<main></main>')
    const j = journey()
    expect(j).toMatchObject({
      firstSeen: '2026-11-17',
      visits: 1,
      referrer: 'https://www.google.com/search?q=gh',
      utm: { source: 'yandex', medium: 'cpc', campaign: 'spring' },
    })
    expect(j.pages).toEqual([expect.objectContaining({ path: '/ru/', title: 'Главная', seconds: 0 })])
    Object.defineProperty(document, 'referrer', { configurable: true, value: '' })
  })

  it('новый визит — после 30 минут тишины; внутри визита счётчик не растёт', () => {
    mount('<main></main>')
    delete (window as any).__ghLeads
    jest.setSystemTime(new Date('2026-11-17T10:20:00Z'))
    run()
    expect(journey().visits).toBe(1)
    delete (window as any).__ghLeads
    jest.setSystemTime(new Date('2026-11-17T11:00:00Z'))
    run()
    expect(journey().visits).toBe(2)
    expect(journey().pages).toHaveLength(3)
  })

  it('время на странице — пока вкладка видна; пишется при уходе', () => {
    mount('<main></main>')
    jest.advanceTimersByTime(95_000)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(journey().pages[0].seconds).toBe(95)
    // Скрытая вкладка время не копит.
    jest.advanceTimersByTime(60_000)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    jest.advanceTimersByTime(5_000)
    window.dispatchEvent(new Event('pagehide'))
    expect(journey().pages[0].seconds).toBe(100)
  })

  it('хранит не больше 30 страниц', () => {
    for (let i = 0; i < 35; i++) {
      delete (window as any).__ghLeads
      run()
    }
    expect(journey().pages).toHaveLength(30)
  })

  it('открытые планировки — без подряд идущих повторов', () => {
    mount(`
      <article class="apartment-card"><h3>2-комн. 54.6 м²</h3><span data-card-project>Dostlik</span></article>
      <article class="apartment-card"><h3>Студия 24 м²</h3><span data-card-project>Dostlik</span></article>`)
    const [a, b] = Array.from(document.querySelectorAll('.apartment-card'))
    click(a.querySelector('h3')!)
    click(a)
    click(b)
    expect(journey().plans).toEqual([
      { title: '2-комн. 54.6 м²', project: 'Dostlik' },
      { title: 'Студия 24 м²', project: 'Dostlik' },
    ])
  })

  it('путь уходит с заявкой (без служебных id), время текущей страницы досчитано', () => {
    mount(CALLBACK)
    jest.advanceTimersByTime(42_000)
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    click(form.querySelector('button')!)
    const body = sent()
    expect(body.journey.visits).toBe(1)
    expect(body.journey.pages).toEqual([{ path: '/ru/', title: expect.any(String), seconds: 42 }])
    expect(body.journey.pages[0]).not.toHaveProperty('id')
  })

  it('старые заявки Site JS v2 (имена и телефоны) из браузера удаляются', () => {
    localStorage.setItem('goldenHouseLeads', '[{"fields":{"phone":"+998"}}]')
    mount('<main></main>')
    expect(localStorage.getItem('goldenHouseLeads')).toBeNull()
  })
})

describe('фильтры и окно планировки', () => {
  const TOOLBAR = `
    <div class="apartment-toolbar">
      <button data-filter="rooms" data-value="2" class="active">2</button>
      <button data-filter="rooms" data-value="3" class="active">3</button>
      <button data-filter="rooms" data-value="4">4</button>
      <input data-filter="areaMin" value="50"><input data-filter="areaMax" value="70">
      <input data-filter="floorMin" value=""><input data-filter="floorMax" value="9">
      <button data-filter-action="apply">Применить</button>
    </div>`

  it('фильтры страницы уходят с заявкой человекочитаемо', () => {
    mount(TOOLBAR + CALLBACK)
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    click(form.querySelector('button[type="submit"]')!)
    expect(sent().filters).toEqual({ Комнаты: '2, 3', Площадь: 'от 50 до 70', Этаж: 'до 9' })
  })

  it('применённые фильтры запоминаются — уходят и с заявкой с другой страницы', () => {
    mount(TOOLBAR)
    click(document.querySelector('[data-filter-action="apply"]')!)
    expect(journey().filters).toMatchObject({ Комнаты: '2, 3' })
    document.body.innerHTML = ''
    delete (window as any).__ghLeads
    mount(CALLBACK)
    fill(document.querySelector('form')!, { phone: '901234567' })
    click(document.querySelector('form button')!)
    expect(sent().filters).toMatchObject({ Комнаты: '2, 3', Площадь: 'от 50 до 70' })
  })

  it('форма окна планировки: вид plan и снимок карточки из ghPlanModal.current()', () => {
    mount(`
      <article class="apartment-card" data-plan-type="p-uuid" data-rooms="2" data-area-min="54.6"
               data-area-max="56.1" data-deadline="4 кв. 2026">
        <h3>2-комн. 54.6 м²</h3><span data-card-project>Dostlik</span><span data-card-floors>этажи 2–9</span>
      </article>
      <div class="plan-modal-lead">
        <form class="plan-modal-lead-form" data-lead-kind="plan">
          <input name="name"><input name="phone" type="tel"><button type="submit">Отправить заявку</button>
        </form>
      </div>`)
    const card = document.querySelector('.apartment-card')
    ;(window as any).ghPlanModal = { current: () => card }
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    click(form.querySelector('button')!)
    expect(sent()).toMatchObject({
      kind: 'plan',
      form: 'Окно планировки',
      plan: {
        id: 'p-uuid',
        title: '2-комн. 54.6 м²',
        project: 'Dostlik',
        floors: 'этажи 2–9',
        deadline: '4 кв. 2026',
        rooms: 2,
        areaMin: 54.6,
        areaMax: 56.1,
      },
    })
  })

  it('карточка без id и площади — снимок без пустых полей', () => {
    mount(`<article class="apartment-card"><h3>Студия</h3></article>
      <form data-lead-kind="plan"><input name="phone"><button type="submit">Отправить</button></form>`)
    ;(window as any).ghPlanModal = { current: () => document.querySelector('.apartment-card') }
    fill(document.querySelector('form')!, { phone: '901234567' })
    click(document.querySelector('form button')!)
    expect(sent().plan).toEqual({ title: 'Студия' })
  })
})
