/**
 * @jest-environment jsdom
 *
 * Скрипт фильтров секции «Выбрать» в браузере.
 *
 * Скрипт встраивается в страницу строкой, поэтому проверяется по-честному:
 * запускается в jsdom на разметке, повторяющей деплой шаблона проекта.
 * Каждый тест собирает страницу заново; обработчики на document от прошлых
 * тестов остаются, но работают с уже удалённой разметкой и ничего не меняют.
 */
import { FILTERS_JS } from '../scripts/choiceFilters.assets'

interface Card {
  rooms: string
  price: number
  priceMax?: number
  deadline?: string
  views?: string
}

function chips(field: string, values: string[]): string {
  return values
    .map((v) => `<button type="button" data-filter="${field}" data-value="${v}">${v}</button>`)
    .join('')
}

function page(cards: Card[], lang = 'ru', deadlines: string[] = []): Document {
  const rooms = [...new Set(cards.map((c) => c.rooms))]
  const priceBox = `<div class="filter-group"><h3>Цена</h3><div class="range-box">
      <input type="number" data-filter="priceMin" placeholder="от" />
      <input type="number" data-filter="priceMax" placeholder="до" /></div></div>`
  const actions = `<div class="panel-actions">
      <button type="button" data-filter-action="reset">Сбросить</button>
      <button type="button" data-filter-action="apply">Показать</button></div>`
  document.documentElement.setAttribute('lang', lang)
  document.body.innerHTML = `
  <section id="choice" class="detail-section">
    <div class="apartment-toolbar">
      <button type="button" class="filter-trigger" data-panel="rooms">Комнатность</button>
      <button type="button" class="filter-trigger" data-panel="deadline">Срок сдачи</button>
      <button type="button" class="filter-trigger" data-panel="price">Цена</button>
      <button type="button" class="filter-trigger" data-panel="all">Все фильтры</button>
      <button type="button" class="reset-filter">Сбросить</button>
      <div class="filter-panel" data-panel="rooms">
        <div class="filter-group" id="g-rooms"><div class="chip-row">${chips('rooms', rooms)}</div></div>${actions}
      </div>
      <div class="filter-panel" data-panel="deadline">
        <div class="filter-group" id="g-deadline"><div class="chip-row">${chips('deadline', deadlines)}</div></div>${actions}
      </div>
      <div class="filter-panel" data-panel="price">${priceBox}${actions}</div>
      <div class="filter-panel" data-panel="all">
        <div class="filter-group" id="g-all-rooms"><div class="chip-row">${chips('rooms', rooms)}</div></div>
        <div class="filter-group" id="g-all-deadline"><div class="chip-row">${chips('deadline', deadlines)}</div></div>
        ${priceBox}${actions}
      </div>
    </div>
    <div class="apartments-grid">${cards
      .map(
        (c, i) =>
          `<article class="apartment-card" id="c${i}" data-rooms="${c.rooms}" data-price="${c.price}"` +
          (c.priceMax !== undefined ? ` data-price-max="${c.priceMax}"` : '') +
          ` data-deadline="${c.deadline ?? ''}" data-windowViews="${c.views ?? ''}"></article>`
      )
      .join('')}</div>
  </section>`
  new Function(FILTERS_JS)()
  return document
}

const M = 1_000_000
const CATALOG: Card[] = [
  { rooms: '1', price: 376 * M, priceMax: 400 * M },
  { rooms: '1', price: 545 * M, priceMax: 626 * M },
  { rooms: '2', price: 578 * M, priceMax: 700 * M },
]

function visible(dom: Document): string[] {
  return [...dom.querySelectorAll('.apartment-card')]
    .filter((c) => !(c as HTMLElement).hidden)
    .map((c) => c.id)
}

function chip(dom: Document, field: string, value: string, index = 0): HTMLButtonElement {
  return dom.querySelectorAll(`[data-filter="${field}"][data-value="${value}"]`)[
    index
  ] as HTMLButtonElement
}

function typePrice(dom: Document, kind: 'priceMin' | 'priceMax', value: string, index = 0): void {
  const input = dom.querySelectorAll(`[data-filter="${kind}"]`)[index] as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function applyLabel(dom: Document): string {
  return dom.querySelector('[data-filter-action="apply"]')!.textContent!
}

function emptyMessage(dom: Document): HTMLElement {
  return dom.querySelector('.apartments-empty') as HTMLElement
}

describe('фильтры: исходное состояние', () => {
  const dom = page(CATALOG)

  it('видны все карточки, кнопка показывает их число', () => {
    expect(visible(dom)).toEqual(['c0', 'c1', 'c2'])
    expect(applyLabel(dom)).toBe('Показать · 3')
  })

  it('пустая группа спрятана и в своей панели, и в «Все фильтры»', () => {
    const doc = dom
    expect((doc.getElementById('g-deadline') as HTMLElement).hidden).toBe(true)
    expect((doc.getElementById('g-all-deadline') as HTMLElement).hidden).toBe(true)
    expect((doc.getElementById('g-rooms') as HTMLElement).hidden).toBe(false)
  })

  it('кнопка пустой панели спрятана', () => {
    const trigger = dom.querySelector('[data-panel="deadline"].filter-trigger') as HTMLElement
    expect(trigger.style.display).toBe('none')
  })

  it('подсказки цены — реальный диапазон каталога', () => {
    const [min] = dom.querySelectorAll('[data-filter="priceMin"]')
    const [max] = dom.querySelectorAll('[data-filter="priceMax"]')
    expect(min.getAttribute('placeholder')).toBe('от 376 000 000')
    expect(max.getAttribute('placeholder')).toBe('до 700 000 000')
  })

  it('пустого сообщения нет', () => {
    expect(emptyMessage(dom).hidden).toBe(true)
  })
})

describe('фильтры: варианты сужаются под остальные условия', () => {
  it('цена до 400 млн — «2» выключен в обеих панелях, «1» доступен', () => {
    const dom = page(CATALOG)
    typePrice(dom, 'priceMax', String(400 * M))
    expect(visible(dom)).toEqual(['c0'])
    expect(chip(dom, 'rooms', '2', 0).disabled).toBe(true)
    expect(chip(dom, 'rooms', '2', 1).disabled).toBe(true)
    expect(chip(dom, 'rooms', '1').disabled).toBe(false)
    expect(applyLabel(dom)).toBe('Показать · 1')
  })

  it('выключенный чипс не выбирается кликом', () => {
    const dom = page(CATALOG)
    typePrice(dom, 'priceMax', String(400 * M))
    chip(dom, 'rooms', '2').click()
    expect(chip(dom, 'rooms', '2').classList.contains('active')).toBe(false)
    expect(visible(dom)).toEqual(['c0'])
  })

  it('выбранный чипс остаётся доступным, даже если цена его исключила', () => {
    const dom = page(CATALOG)
    chip(dom, 'rooms', '2').click()
    typePrice(dom, 'priceMax', String(400 * M))
    expect(visible(dom)).toEqual([])
    expect(chip(dom, 'rooms', '2').disabled).toBe(false)
    chip(dom, 'rooms', '2').click()
    expect(visible(dom)).toEqual(['c0'])
  })

  it('варианты своего поля не выключаются выбором в нём же', () => {
    const dom = page(CATALOG)
    chip(dom, 'rooms', '1').click()
    expect(visible(dom)).toEqual(['c0', 'c1'])
    expect(chip(dom, 'rooms', '2').disabled).toBe(false)
  })

  it('комнатность сужает подсказку цены', () => {
    const dom = page(CATALOG)
    chip(dom, 'rooms', '2').click()
    const [min] = dom.querySelectorAll('[data-filter="priceMin"]')
    expect(min.getAttribute('placeholder')).toBe('от 578 000 000')
  })

  it('чипс одного поля синхронен в своей панели и в «Все фильтры»', () => {
    const dom = page(CATALOG)
    chip(dom, 'rooms', '1', 1).click()
    expect(chip(dom, 'rooms', '1', 0).classList.contains('active')).toBe(true)
  })
})

describe('фильтры: цена — диапазон карточки', () => {
  it('«от 600 млн» оставляет карточку 545–626: в ней есть квартиры дороже', () => {
    const dom = page(CATALOG)
    typePrice(dom, 'priceMin', String(600 * M))
    expect(visible(dom)).toEqual(['c1', 'c2'])
  })

  it('диапазон целиком вне заданного — карточка скрыта', () => {
    const dom = page(CATALOG)
    typePrice(dom, 'priceMin', String(410 * M))
    typePrice(dom, 'priceMax', String(540 * M))
    expect(visible(dom)).toEqual([])
    expect(emptyMessage(dom).hidden).toBe(false)
  })

  it('без data-price-max карточка сравнивается по одной цене', () => {
    const dom = page([{ rooms: '1', price: 500 * M }])
    typePrice(dom, 'priceMin', String(501 * M))
    expect(visible(dom)).toEqual([])
  })

  it('карточка без цены под ценовой фильтр не попадает', () => {
    const dom = page([{ rooms: '1', price: 0 }, { rooms: '1', price: 300 * M }])
    typePrice(dom, 'priceMax', String(400 * M))
    expect(visible(dom)).toEqual(['c1'])
  })

  it('ввод в одной панели копируется в другую', () => {
    const dom = page(CATALOG)
    typePrice(dom, 'priceMax', String(400 * M), 1)
    const inputs = dom.querySelectorAll('[data-filter="priceMax"]')
    expect((inputs[0] as HTMLInputElement).value).toBe(String(400 * M))
  })
})

describe('фильтры: множества и сброс', () => {
  it('значение-множество через «|» совпадает по любому элементу', () => {
    const dom = page(
      [
        { rooms: '1', price: M, deadline: '2026|2027' },
        { rooms: '1', price: M, deadline: '2028' },
      ],
      'ru',
      ['2026', '2027', '2028']
    )
    chip(dom, 'deadline', '2027').click()
    expect(visible(dom)).toEqual(['c0'])
  })

  it('сброс возвращает всё и снимает отметки', () => {
    const dom = page(CATALOG)
    chip(dom, 'rooms', '2').click()
    typePrice(dom, 'priceMin', String(600 * M))
    ;(dom.querySelector('.reset-filter') as HTMLButtonElement).click()
    expect(visible(dom)).toEqual(['c0', 'c1', 'c2'])
    expect(chip(dom, 'rooms', '2').classList.contains('active')).toBe(false)
    const input = dom.querySelector('[data-filter="priceMin"]') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('кнопка панели отмечена, пока в её поле что-то выбрано', () => {
    const dom = page(CATALOG)
    const doc = dom
    chip(dom, 'rooms', '1').click()
    expect(doc.querySelector('.filter-trigger[data-panel="rooms"]')!.classList.contains('has-value')).toBe(true)
    expect(doc.querySelector('.filter-trigger[data-panel="all"]')!.classList.contains('has-value')).toBe(true)
    expect(doc.querySelector('.filter-trigger[data-panel="price"]')!.classList.contains('has-value')).toBe(false)
  })
})

describe('фильтры: панели', () => {
  function trigger(dom: Document, name: string): HTMLButtonElement {
    return dom.querySelector(`.filter-trigger[data-panel="${name}"]`) as HTMLButtonElement
  }
  function panel(dom: Document, name: string): HTMLElement {
    return dom.querySelector(`.filter-panel[data-panel="${name}"]`) as HTMLElement
  }

  function rect(el: Element, r: { top?: number; bottom?: number; left?: number; width?: number }): void {
    const box = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, ...r }
    ;(el as HTMLElement).getBoundingClientRect = () => ({ ...box, toJSON: () => box }) as DOMRect
  }

  function layout(dom: Document, panelWidth: number): void {
    rect(dom.querySelector('.apartment-toolbar')!, { top: 100, left: 50, width: 1000 })
    rect(trigger(dom, 'all'), { top: 120, bottom: 168, left: 300 })
    Object.defineProperty(panel(dom, 'all'), 'offsetWidth', { configurable: true, value: panelWidth })
  }

  it('панель открывается прямо под своей кнопкой: +8 px от низа, по её левому краю', () => {
    const dom = page(CATALOG)
    layout(dom, 560)
    trigger(dom, 'all').click()
    expect(panel(dom, 'all').style.top).toBe('76px') // 168 − 100 + 8
    expect(panel(dom, 'all').style.left).toBe('250px') // 300 − 50
  })

  it('не помещается справа — сдвигается влево ровно настолько, насколько вылезает', () => {
    const dom = page(CATALOG)
    layout(dom, 900) // 250 + 900 = 1150 > 1000 → на 150 левее
    trigger(dom, 'all').click()
    expect(panel(dom, 'all').style.left).toBe('100px')
  })

  it('шире тулбара — прижимается к левому краю, а не уходит в минус', () => {
    const dom = page(CATALOG)
    layout(dom, 1400)
    trigger(dom, 'all').click()
    expect(panel(dom, 'all').style.left).toBe('0px')
  })

  it('на узком экране ставится только высота, ширину задаёт CSS', () => {
    const original = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: true, media: q })) as unknown as typeof window.matchMedia
    try {
      const dom = page(CATALOG)
      layout(dom, 560)
      trigger(dom, 'all').click()
      expect(panel(dom, 'all').style.top).toBe('76px')
      expect(panel(dom, 'all').style.left).toBe('')
    } finally {
      window.matchMedia = original
    }
  })

  it('клик по чипсу внутри открытой панели выбирает его и не закрывает панель', () => {
    // Регрессия v1: stopPropagation на панели глушил делегат на toolbar.
    const dom = page(CATALOG)
    trigger(dom, 'rooms').click()
    chip(dom, 'rooms', '2').click()
    expect(chip(dom, 'rooms', '2').classList.contains('active')).toBe(true)
    expect(visible(dom)).toEqual(['c2'])
    expect(panel(dom, 'rooms').classList.contains('is-open')).toBe(true)
  })

  it('клик мимо панели закрывает её', () => {
    const dom = page(CATALOG)
    trigger(dom, 'rooms').click()
    dom.body.click()
    expect(panel(dom, 'rooms').classList.contains('is-open')).toBe(false)
  })

  it('повторный клик по кнопке панели закрывает её, другая кнопка — переключает', () => {
    const dom = page(CATALOG)
    trigger(dom, 'rooms').click()
    trigger(dom, 'price').click()
    expect(panel(dom, 'rooms').classList.contains('is-open')).toBe(false)
    expect(panel(dom, 'price').classList.contains('is-open')).toBe(true)
    trigger(dom, 'price').click()
    expect(panel(dom, 'price').classList.contains('is-open')).toBe(false)
  })

  it('«Показать» закрывает панель, выбор сохраняется', () => {
    const dom = page(CATALOG)
    trigger(dom, 'rooms').click()
    chip(dom, 'rooms', '1').click()
    ;(panel(dom, 'rooms').querySelector('[data-filter-action="apply"]') as HTMLButtonElement).click()
    expect(panel(dom, 'rooms').classList.contains('is-open')).toBe(false)
    expect(visible(dom)).toEqual(['c0', 'c1'])
  })
})

describe('фильтры: язык страницы', () => {
  it('uz: пустое сообщение и подсказки цены по-узбекски', () => {
    const dom = page(CATALOG, 'uz')
    typePrice(dom, 'priceMax', '1')
    expect(emptyMessage(dom).textContent).toContain("rejalar yo'q")
    const [min] = dom.querySelectorAll('[data-filter="priceMin"]')
    expect(min.getAttribute('placeholder')).toBe('376 000 000 dan')
  })

  it('неизвестный язык — русский', () => {
    const dom = page(CATALOG, 'de')
    typePrice(dom, 'priceMax', '1')
    expect(emptyMessage(dom).textContent).toContain('планировок нет')
  })
})
