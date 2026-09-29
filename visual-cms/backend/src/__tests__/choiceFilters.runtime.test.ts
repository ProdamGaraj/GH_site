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
  /** Площадь группы «от/до»; одно число — группа одной площади. */
  area?: [number, number] | number
  /** Этажи, где есть квартиры группы: «2,3,12». */
  floors?: number[]
  deadline?: string
  views?: string
}

function chips(field: string, values: string[]): string {
  return values
    .map((v) => `<button type="button" data-filter="${field}" data-value="${v}">${v}</button>`)
    .join('')
}

/** Группа «от/до», как её кладёт миграция (choiceRanges.ts). */
function rangeGroup(name: string, title: string, unit: string | null): string {
  return `<div class="filter-group filter-group--range" id="g-${name}"><h3>${title}</h3><div class="range-box">
      <input type="number" data-filter="${name}Min" placeholder="от" /><span>—</span>
      <input type="number" data-filter="${name}Max" placeholder="до" />${unit ? `<span class="range-unit">${unit}</span>` : ''}</div></div>`
}

function page(cards: Card[], lang = 'ru', deadlines: string[] = []): Document {
  const rooms = [...new Set(cards.map((c) => c.rooms))]
  const area = () => rangeGroup('area', 'Площадь, м²', 'м²')
  const floor = () => rangeGroup('floor', 'Этаж', null)
  const actions = `<div class="panel-actions">
      <button type="button" data-filter-action="reset">Сбросить</button>
      <button type="button" data-filter-action="apply">Показать</button></div>`
  document.documentElement.setAttribute('lang', lang)
  document.body.innerHTML = `
  <section id="choice" class="detail-section">
    <div class="apartment-toolbar">
      <div class="filter-main">
        <button type="button" class="filter-trigger" data-panel="rooms">Комнатность</button>
        <button type="button" class="filter-trigger" data-panel="deadline">Срок сдачи</button>
        <button type="button" class="filter-trigger" data-panel="area">Площадь</button>
        <button type="button" class="filter-trigger" data-panel="floor">Этаж</button>
        <button type="button" class="filter-trigger" data-panel="all">Все фильтры</button>
        <button type="button" class="reset-filter">Сбросить</button>
      </div>
      <div class="filter-panel" data-panel="rooms">
        <div class="filter-group" id="g-rooms"><h3>Комнатность</h3><div class="chip-row">${chips('rooms', rooms)}</div></div>${actions}
      </div>
      <div class="filter-panel" data-panel="deadline">
        <div class="filter-group" id="g-deadline"><div class="chip-row">${chips('deadline', deadlines)}</div></div>${actions}
      </div>
      <div class="filter-panel" data-panel="area">${area()}${actions}</div>
      <div class="filter-panel" data-panel="floor">${floor()}${actions}</div>
      <div class="filter-panel" data-panel="all">
        <div class="filter-group" id="g-all-rooms"><div class="chip-row">${chips('rooms', rooms)}</div></div>
        ${area().replace('id="g-area"', 'id="g-all-area"')}
        ${floor().replace('id="g-floor"', 'id="g-all-floor"')}
        <div class="filter-group" id="g-all-deadline"><div class="chip-row">${chips('deadline', deadlines)}</div></div>
        ${actions}
      </div>
    </div>
    <div class="apartments-grid">${cards
      .map((c, i) => {
        const [lo, hi] = c.area === undefined ? ['', ''] : Array.isArray(c.area) ? c.area : [c.area, c.area]
        return (
          `<article class="apartment-card" id="c${i}" data-rooms="${c.rooms}"` +
          ` data-area-min="${lo}" data-area-max="${hi}" data-floors="${(c.floors ?? []).join(',')}"` +
          ` data-deadline="${c.deadline ?? ''}" data-windowViews="${c.views ?? ''}"></article>`
        )
      })
      .join('')}</div>
  </section>`
  new Function(FILTERS_JS)()
  return document
}

const CATALOG: Card[] = [
  { rooms: '1', area: 34.87, floors: [2, 3, 4] },
  { rooms: '1', area: [41.2, 44.9], floors: [5, 12] },
  { rooms: '2', area: [55.64, 70.1], floors: [3, 16] },
]

function visible(dom: Document): string[] {
  return [...dom.querySelectorAll('.apartment-card')]
    .filter((c) => !(c as HTMLElement).hidden)
    .map((c) => c.id)
}

function chip(dom: Document, field: string, value: string, index = 0): HTMLButtonElement {
  return dom.querySelectorAll(`[data-filter="${field}"][data-value="${value}"]`)[index] as HTMLButtonElement
}

function type(dom: Document, kind: string, value: string, index = 0): void {
  const input = dom.querySelectorAll(`[data-filter="${kind}"]`)[index] as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function placeholder(dom: Document, kind: string, index = 0): string | null {
  return dom.querySelectorAll(`[data-filter="${kind}"]`)[index].getAttribute('placeholder')
}

function applyLabel(dom: Document): string {
  return dom.querySelector('[data-filter-action="apply"]')!.textContent!
}

function emptyMessage(dom: Document): HTMLElement {
  return dom.querySelector('.apartments-empty') as HTMLElement
}

function trigger(dom: Document, name: string): HTMLButtonElement {
  return dom.querySelector(`.filter-trigger[data-panel="${name}"]`) as HTMLButtonElement
}

describe('фильтры: исходное состояние', () => {
  const dom = page(CATALOG)

  it('видны все карточки, кнопка показывает их число', () => {
    expect(visible(dom)).toEqual(['c0', 'c1', 'c2'])
    expect(applyLabel(dom)).toBe('Показать · 3')
  })

  it('пустая группа спрятана и в своей панели, и в «Все фильтры»', () => {
    expect((dom.getElementById('g-deadline') as HTMLElement).hidden).toBe(true)
    expect((dom.getElementById('g-all-deadline') as HTMLElement).hidden).toBe(true)
    expect((dom.getElementById('g-rooms') as HTMLElement).hidden).toBe(false)
  })

  it('кнопка пустой панели спрятана', () => {
    expect(trigger(dom, 'deadline').style.display).toBe('none')
    expect(trigger(dom, 'area').style.display).toBe('')
  })

  it('подсказки — реальные границы каталога, с запасом до целого', () => {
    expect(placeholder(dom, 'areaMin')).toBe('от 34')
    expect(placeholder(dom, 'areaMax')).toBe('до 71')
    expect(placeholder(dom, 'floorMin')).toBe('от 2')
    expect(placeholder(dom, 'floorMax')).toBe('до 16')
  })

  it('пустого сообщения нет', () => {
    expect(emptyMessage(dom).hidden).toBe(true)
  })

  it('цены нет: ни полей, ни чтения data-price', () => {
    expect(dom.querySelector('[data-filter^="price"]')).toBeNull()
    expect(FILTERS_JS).not.toMatch(/data-price|priceMin/)
  })
})

describe('фильтры: площадь — диапазон группы', () => {
  it('«от 44» оставляет группу 41.2–44.9: в ней есть квартиры больше', () => {
    const dom = page(CATALOG)
    type(dom, 'areaMin', '44')
    expect(visible(dom)).toEqual(['c1', 'c2'])
  })

  it('«до 40» — только маленькая', () => {
    const dom = page(CATALOG)
    type(dom, 'areaMax', '40')
    expect(visible(dom)).toEqual(['c0'])
  })

  it('диапазон между группами — пусто, видно сообщение', () => {
    const dom = page(CATALOG)
    type(dom, 'areaMin', '46')
    type(dom, 'areaMax', '50')
    expect(visible(dom)).toEqual([])
    expect(emptyMessage(dom).hidden).toBe(false)
  })

  it('перепутанные «от» и «до» меняются местами', () => {
    const dom = page(CATALOG)
    type(dom, 'areaMin', '50')
    type(dom, 'areaMax', '40')
    expect(visible(dom)).toEqual(['c1'])
  })

  it('карточка без площади под фильтр площади не попадает', () => {
    const dom = page([{ rooms: '1', area: 50 }, { rooms: '1' }])
    type(dom, 'areaMax', '100')
    expect(visible(dom)).toEqual(['c0'])
  })
})

describe('фильтры: этаж — хоть одна квартира группы на этаже из диапазона', () => {
  it('этажи 5–8: группа с 5 и 12 подходит, со 2–4 и с 3, 16 — нет', () => {
    const dom = page(CATALOG)
    type(dom, 'floorMin', '5')
    type(dom, 'floorMax', '8')
    expect(visible(dom)).toEqual(['c1'])
  })

  it('пропуск этажей учитывается: у группы 3 и 16 нет квартир на 6–15', () => {
    const dom = page(CATALOG)
    type(dom, 'floorMin', '6')
    type(dom, 'floorMax', '11')
    expect(visible(dom)).toEqual([])
  })

  it('только «от 13» — группа с 16-м этажом', () => {
    const dom = page(CATALOG)
    type(dom, 'floorMin', '13')
    expect(visible(dom)).toEqual(['c2'])
  })

  it('этаж и площадь вместе — по И', () => {
    const dom = page(CATALOG)
    type(dom, 'floorMin', '12')
    type(dom, 'areaMax', '50')
    expect(visible(dom)).toEqual(['c1'])
  })
})

describe('фильтры: диапазон без данных', () => {
  it('ни у одной карточки нет этажей — фильтра этажа нет нигде', () => {
    const dom = page([{ rooms: '1', area: 40 }, { rooms: '2', area: 60 }])
    expect((dom.getElementById('g-floor') as HTMLElement).hidden).toBe(true)
    expect((dom.getElementById('g-all-floor') as HTMLElement).hidden).toBe(true)
    expect(trigger(dom, 'floor').style.display).toBe('none')
    expect(dom.querySelector('.filter-inline [data-panel="floor"]')).toBeNull()
    expect(dom.querySelector('.filter-inline [data-panel="area"]')).not.toBeNull()
  })
})

describe('фильтры: варианты сужаются под остальные условия', () => {
  it('площадь до 40 — «2» выключен в обеих панелях, «1» доступен', () => {
    const dom = page(CATALOG)
    type(dom, 'areaMax', '40')
    expect(chip(dom, 'rooms', '2', 0).disabled).toBe(true)
    expect(chip(dom, 'rooms', '2', 1).disabled).toBe(true)
    expect(chip(dom, 'rooms', '1').disabled).toBe(false)
    expect(applyLabel(dom)).toBe('Показать · 1')
  })

  it('выключенный чипс не выбирается кликом', () => {
    const dom = page(CATALOG)
    type(dom, 'areaMax', '40')
    chip(dom, 'rooms', '2').click()
    expect(chip(dom, 'rooms', '2').classList.contains('active')).toBe(false)
    expect(visible(dom)).toEqual(['c0'])
  })

  it('выбранный чипс остаётся доступным, даже если площадь его исключила', () => {
    const dom = page(CATALOG)
    chip(dom, 'rooms', '2').click()
    type(dom, 'areaMax', '40')
    expect(visible(dom)).toEqual([])
    expect(chip(dom, 'rooms', '2').disabled).toBe(false)
    chip(dom, 'rooms', '2').click()
    expect(visible(dom)).toEqual(['c0'])
  })

  it('комнатность сужает подсказки площади и этажа', () => {
    const dom = page(CATALOG)
    chip(dom, 'rooms', '2').click()
    expect(placeholder(dom, 'areaMin')).toBe('от 55')
    expect(placeholder(dom, 'floorMin')).toBe('от 3')
  })

  it('подсказка площади не сужается своим же полем', () => {
    const dom = page(CATALOG)
    type(dom, 'areaMin', '60')
    expect(placeholder(dom, 'areaMin')).toBe('от 34')
  })

  it('чипс одного поля синхронен в своей панели и в «Все фильтры»', () => {
    const dom = page(CATALOG)
    chip(dom, 'rooms', '1', 1).click()
    expect(chip(dom, 'rooms', '1', 0).classList.contains('active')).toBe(true)
  })

  it('ввод в одной панели копируется в другие', () => {
    const dom = page(CATALOG)
    type(dom, 'floorMax', '8', 1)
    const inputs = [...dom.querySelectorAll('[data-filter="floorMax"]')] as HTMLInputElement[]
    expect(inputs.every((i) => i.value === '8')).toBe(true)
  })
})

describe('фильтры: множества и сброс', () => {
  it('значение-множество через «|» совпадает по любому элементу', () => {
    const dom = page(
      [
        { rooms: '1', deadline: '2026|2027' },
        { rooms: '1', deadline: '2028' },
      ],
      'ru',
      ['2026', '2027', '2028']
    )
    chip(dom, 'deadline', '2027').click()
    expect(visible(dom)).toEqual(['c0'])
  })

  it('сброс возвращает всё и очищает поля «от/до»', () => {
    const dom = page(CATALOG)
    chip(dom, 'rooms', '2').click()
    type(dom, 'areaMin', '60')
    type(dom, 'floorMax', '3')
    ;(dom.querySelector('.reset-filter') as HTMLButtonElement).click()
    expect(visible(dom)).toEqual(['c0', 'c1', 'c2'])
    expect(chip(dom, 'rooms', '2').classList.contains('active')).toBe(false)
    const inputs = [...dom.querySelectorAll('[data-filter^="area"], [data-filter^="floor"]')] as HTMLInputElement[]
    expect(inputs.every((i) => i.value === '')).toBe(true)
  })

  it('кнопка панели отмечена, пока в её поле что-то задано', () => {
    const dom = page(CATALOG)
    chip(dom, 'rooms', '1').click()
    expect(trigger(dom, 'rooms').classList.contains('has-value')).toBe(true)
    expect(trigger(dom, 'all').classList.contains('has-value')).toBe(true)
    expect(trigger(dom, 'area').classList.contains('has-value')).toBe(false)
    type(dom, 'areaMin', '40')
    expect(trigger(dom, 'area').classList.contains('has-value')).toBe(true)
    expect(trigger(dom, 'floor').classList.contains('has-value')).toBe(false)
  })
})

describe('фильтры: панели', () => {
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
    ;(panel(dom, 'rooms').querySelector('[data-value="2"]') as HTMLButtonElement).click()
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
    trigger(dom, 'floor').click()
    expect(panel(dom, 'rooms').classList.contains('is-open')).toBe(false)
    expect(panel(dom, 'floor').classList.contains('is-open')).toBe(true)
    trigger(dom, 'floor').click()
    expect(panel(dom, 'floor').classList.contains('is-open')).toBe(false)
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
  it('uz: пустое сообщение и подсказки по-узбекски', () => {
    const dom = page(CATALOG, 'uz')
    expect(placeholder(dom, 'floorMin')).toBe('2 dan')
    expect(placeholder(dom, 'floorMax')).toBe('16 gacha')
    type(dom, 'areaMax', '1')
    expect(emptyMessage(dom).textContent).toContain("rejalar yo'q")
    // Под условием ничего нет — подсказка этажа возвращается к исходной.
    expect(placeholder(dom, 'floorMin')).toBe('от')
  })

  it('неизвестный язык — русский', () => {
    const dom = page(CATALOG, 'de')
    type(dom, 'areaMax', '1')
    expect(emptyMessage(dom).textContent).toContain('планировок нет')
  })
})

describe('фильтры: строка на десктопе', () => {
  function inline(dom: Document): HTMLElement {
    return dom.querySelector('.filter-main > .filter-inline') as HTMLElement
  }
  function inlineChip(dom: Document, value: string): HTMLButtonElement {
    return inline(dom).querySelector(`[data-filter="rooms"][data-value="${value}"]`) as HTMLButtonElement
  }
  function inlineInput(dom: Document, kind: string): HTMLInputElement {
    return inline(dom).querySelector(`[data-filter="${kind}"]`) as HTMLInputElement
  }

  it('собирается в начале .filter-main: комнатность, площадь и этаж с подписями из заголовков панелей', () => {
    const dom = page(CATALOG)
    const groups = [...inline(dom).querySelectorAll('.filter-inline-group')]
    expect(groups.map((g) => g.getAttribute('data-panel'))).toEqual(['rooms', 'area', 'floor'])
    expect(groups.map((g) => g.querySelector('.filter-inline-label')!.textContent)).toEqual([
      'Комнатность',
      'Площадь, м²',
      'Этаж',
    ])
    expect(dom.querySelector('.filter-main')!.firstElementChild).toBe(inline(dom))
  })

  it('единица площади в строке помечена — CSS прячет её: «м²» уже в подписи', () => {
    const dom = page(CATALOG)
    expect(inline(dom).querySelector('[data-panel="area"] .range-unit')!.textContent).toBe('м²')
  })

  it('чипс в строке фильтрует и синхронен с чипсами в панелях', () => {
    const dom = page(CATALOG)
    inlineChip(dom, '2').click()
    expect(visible(dom)).toEqual(['c2'])
    const all = [...dom.querySelectorAll('[data-filter="rooms"][data-value="2"]')]
    expect(all.length).toBe(3) // строка + своя панель + «Все фильтры»
    expect(all.every((c) => c.classList.contains('active'))).toBe(true)
  })

  it('этаж в строке фильтрует и копируется в поля панелей', () => {
    const dom = page(CATALOG)
    const input = inlineInput(dom, 'floorMin')
    input.value = '13'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(visible(dom)).toEqual(['c2'])
    const others = [...dom.querySelectorAll('.filter-panel [data-filter="floorMin"]')] as HTMLInputElement[]
    expect(others.every((i) => i.value === '13')).toBe(true)
    expect(inlineChip(dom, '1').disabled).toBe(true)
  })

  it('подсказки обновляются и в строке', () => {
    const dom = page(CATALOG)
    expect(inlineInput(dom, 'areaMin').getAttribute('placeholder')).toBe('от 34')
  })

  it('счётчик и «Сбросить» — одна пара в конце строки, счётчик показывает число карточек', () => {
    const dom = page(CATALOG)
    const summary = dom.querySelector('.filter-main > .filter-summary') as HTMLElement
    const count = summary.querySelector('.filter-count') as HTMLElement
    expect(count.nextElementSibling!.classList.contains('reset-filter')).toBe(true)
    expect(dom.querySelector('.filter-main')!.lastElementChild).toBe(summary)
    expect(count.textContent).toBe('Найдено: 3')
    inlineChip(dom, '1').click()
    expect(count.textContent).toBe('Найдено: 2')
  })

  it('счётчик на языке страницы', () => {
    const dom = page(CATALOG, 'uz')
    expect(dom.querySelector('.filter-count')!.textContent).toBe('Topildi: 3')
  })

  it('сброс очищает и строку', () => {
    const dom = page(CATALOG)
    inlineChip(dom, '1').click()
    const input = inlineInput(dom, 'areaMin')
    input.value = '1'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    ;(dom.querySelector('.reset-filter') as HTMLButtonElement).click()
    expect(inlineChip(dom, '1').classList.contains('active')).toBe(false)
    expect(input.value).toBe('')
    expect(visible(dom)).toEqual(['c0', 'c1', 'c2'])
  })

  it('клик по чипсу в строке закрывает открытую панель — она больше не нужна', () => {
    const dom = page(CATALOG)
    trigger(dom, 'all').click()
    inlineChip(dom, '1').click()
    expect(dom.querySelector('.filter-panel[data-panel="all"]')!.classList.contains('is-open')).toBe(false)
  })
})
