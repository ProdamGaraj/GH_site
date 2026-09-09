/**
 * @jest-environment jsdom
 *
 * Фильтр карточек планировок.
 *
 * Главное, что здесь проверяется, — семантика сравнения. Карточка несёт не
 * значения квартиры, а диапазоны и множества по всем квартирам своего типа,
 * поэтому фильтр обязан считать пересечение, а не равенство. Обычное сравнение
 * дало бы пустую выдачу на любом фильтре, и заметить это без теста тяжело:
 * страница выглядит рабочей, просто ничего не находит.
 */

import { generatePlanFilterRuntime, hasPlanFilters } from '../services/PlanFilterRuntime'

const RUNTIME_JS = generatePlanFilterRuntime('data-filter-root')
  .replace(/^\s*<script>/, '')
  .replace(/<\/script>\s*$/, '')

interface CardSpec {
  id: string
  rooms?: number
  priceMin?: number
  priceMax?: number
  areaMin?: number
  areaMax?: number
  floors?: string
  views?: string
}

function card(spec: CardSpec): string {
  const attrs = [
    `data-filter-item="true"`,
    `data-card="${spec.id}"`,
    spec.rooms !== undefined ? `data-rooms="${spec.rooms}"` : '',
    spec.priceMin !== undefined ? `data-price-min="${spec.priceMin}"` : '',
    spec.priceMax !== undefined ? `data-price-max="${spec.priceMax}"` : '',
    spec.areaMin !== undefined ? `data-area-min="${spec.areaMin}"` : '',
    spec.areaMax !== undefined ? `data-area-max="${spec.areaMax}"` : '',
    spec.floors !== undefined ? `data-floors="${spec.floors}"` : '',
    spec.views !== undefined ? `data-views="${spec.views}"` : '',
  ].filter(Boolean).join(' ')
  return `<article ${attrs}></article>`
}

function chip(field: string, value: string, opts: { op?: string; multiple?: boolean; active?: boolean } = {}): string {
  return `<button data-filter-chip="true" data-filter-field="${field}" data-filter-value="${value}"
    ${opts.op ? `data-filter-op="${opts.op}"` : ''}
    ${opts.multiple ? 'data-filter-multiple="true"' : ''}
    class="${opts.active ? 'is-active' : ''}">${value || 'Все'}</button>`
}

function rangeInput(field: string, bound: 'min' | 'max'): string {
  return `<input type="number" data-filter-field="${field}" data-filter-bound="${bound}">`
}

function boot(html: string): void {
  document.body.innerHTML = `<section data-filter-root="true">${html}</section>`
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  new Function(RUNTIME_JS)()
}

const visibleIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-filter-item]'))
    .filter((el) => !(el as HTMLElement).hidden)
    .map((el) => el.getAttribute('data-card')!)

const clickChip = (field: string, value: string): void => {
  const el = document.querySelector(
    `[data-filter-chip][data-filter-field="${field}"][data-filter-value="${value}"]`
  ) as HTMLElement
  el.click()
}

const setRange = (field: string, bound: 'min' | 'max', value: string): void => {
  const input = document.querySelector(
    `input[data-filter-field="${field}"][data-filter-bound="${bound}"]`
  ) as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Три типа: дешёвый однокомнатный, средний двух-, дорогой трёхкомнатный. */
const CARDS = [
  card({ id: 'a', rooms: 1, priceMin: 800, priceMax: 900, areaMin: 37, areaMax: 40, floors: '2,3,4', views: 'двор' }),
  card({ id: 'b', rooms: 2, priceMin: 1100, priceMax: 1400, areaMin: 55, areaMax: 56, floors: '5,6,12', views: 'двор|бульвар' }),
  card({ id: 'c', rooms: 3, priceMin: 1900, priceMax: 2200, areaMin: 77, areaMax: 80, floors: '14,15', views: 'бульвар' }),
].join('')

describe('инжекция', () => {
  it('страница без фильтров рантайм не тащит', () => {
    expect(generatePlanFilterRuntime('<div>обычная страница</div>')).toBe('')
    expect(hasPlanFilters('<div>обычная страница</div>')).toBe(false)
  })

  it('страница с фильтром получает скрипт', () => {
    expect(generatePlanFilterRuntime('<div data-filter-root>')).toContain('<script>')
  })
})

describe('без фильтров', () => {
  it('показаны все карточки', () => {
    boot(CARDS)
    expect(visibleIds()).toEqual(['a', 'b', 'c'])
  })

  it('счётчик проставлен сразу, а не после первого клика', () => {
    boot(`<span data-filter-count></span>${CARDS}`)
    expect(document.querySelector('[data-filter-count]')!.textContent).toBe('3')
  })

  it('заглушка «ничего не найдено» спрятана', () => {
    boot(`<p data-filter-empty>Ничего</p>${CARDS}`)
    expect((document.querySelector('[data-filter-empty]') as HTMLElement).hidden).toBe(true)
  })
})

describe('пересечение диапазонов', () => {
  const HTML = `${rangeInput('price', 'min')}${rangeInput('price', 'max')}${CARDS}`

  it('нижняя граница отсекает то, что целиком дешевле', () => {
    boot(HTML)
    setRange('price', 'min', '1500')
    expect(visibleIds()).toEqual(['c'])
  })

  it('верхняя граница отсекает то, что целиком дороже', () => {
    boot(HTML)
    setRange('price', 'max', '1000')
    expect(visibleIds()).toEqual(['a'])
  })

  it('карточка проходит, если диапазоны пересекаются хотя бы частично', () => {
    boot(HTML)
    // 1200–1300 попадает внутрь диапазона b (1100–1400) и ни в один другой.
    setRange('price', 'min', '1200')
    setRange('price', 'max', '1300')
    expect(visibleIds()).toEqual(['b'])
  })

  it('касание границы считается пересечением', () => {
    boot(HTML)
    setRange('price', 'min', '900')
    setRange('price', 'max', '900')
    expect(visibleIds()).toEqual(['a'])
  })

  it('пустая граница не ограничивает — «до» без значения не отсекает всё', () => {
    boot(HTML)
    setRange('price', 'min', '1000')
    setRange('price', 'max', '')
    expect(visibleIds()).toEqual(['b', 'c'])
  })

  it('очистка обеих границ возвращает всё', () => {
    boot(HTML)
    setRange('price', 'min', '1500')
    setRange('price', 'max', '')
    setRange('price', 'min', '')
    expect(visibleIds()).toEqual(['a', 'b', 'c'])
  })

  it('нечисловой ввод не роняет фильтр', () => {
    boot(HTML)
    setRange('price', 'min', 'дорого')
    expect(visibleIds()).toEqual(['a', 'b', 'c'])
  })

  it('карточка без диапазона по этому полю не отсекается — она ничего не утверждает', () => {
    boot(`${rangeInput('price', 'min')}${CARDS}${card({ id: 'd', rooms: 4 })}`)
    setRange('price', 'min', '1500')
    expect(visibleIds()).toEqual(['c', 'd'])
  })

  it('второй диапазон работает независимо от первого', () => {
    boot(`${rangeInput('price', 'min')}${rangeInput('area', 'max')}${CARDS}`)
    setRange('area', 'max', '45')
    expect(visibleIds()).toEqual(['a'])
  })
})

describe('пересечение множеств', () => {
  it('этаж находит все типы, встречающиеся на нём', () => {
    boot(`${chip('floors', '', { op: 'set', active: true })}${chip('floors', '12', { op: 'set' })}${CARDS}`)
    clickChip('floors', '12')
    expect(visibleIds()).toEqual(['b'])
  })

  it('вид из окон находит типы, где он бывает', () => {
    boot(`${chip('views', '', { op: 'set', active: true })}${chip('views', 'бульвар', { op: 'set' })}${CARDS}`)
    clickChip('views', 'бульвар')
    expect(visibleIds()).toEqual(['b', 'c'])
  })

  it('несколько значений в группе объединяются по ИЛИ', () => {
    boot(
      `${chip('views', '', { op: 'set', active: true })}` +
      `${chip('views', 'двор', { op: 'set', multiple: true })}` +
      `${chip('views', 'бульвар', { op: 'set', multiple: true })}${CARDS}`
    )
    clickChip('views', 'двор')
    clickChip('views', 'бульвар')
    expect(visibleIds()).toEqual(['a', 'b', 'c'])
  })

  it('карточка без такого множества отсеивается', () => {
    boot(
      `${chip('views', '', { op: 'set', active: true })}${chip('views', 'двор', { op: 'set' })}` +
      `${CARDS}${card({ id: 'd', rooms: 4 })}`
    )
    clickChip('views', 'двор')
    expect(visibleIds()).toEqual(['a', 'b'])
  })
})

describe('скалярное поле', () => {
  const HTML =
    `${chip('rooms', '', { active: true })}${chip('rooms', '1')}${chip('rooms', '2')}${chip('rooms', '3')}${CARDS}`

  it('комнатность отбирает точное совпадение', () => {
    boot(HTML)
    clickChip('rooms', '2')
    expect(visibleIds()).toEqual(['b'])
  })

  it('повторный клик снимает выбор и возвращает всё', () => {
    boot(HTML)
    clickChip('rooms', '2')
    clickChip('rooms', '2')
    expect(visibleIds()).toEqual(['a', 'b', 'c'])
  })

  it('выбор другого значения заменяет прежний, а не добавляется', () => {
    boot(HTML)
    clickChip('rooms', '2')
    clickChip('rooms', '3')
    expect(visibleIds()).toEqual(['c'])
  })
})

describe('чипс «Все»', () => {
  const HTML = `${chip('rooms', '', { active: true })}${chip('rooms', '1')}${chip('rooms', '2')}${CARDS}`

  it('выбор значения гасит «Все»', () => {
    boot(HTML)
    clickChip('rooms', '1')
    const all = document.querySelector('[data-filter-field="rooms"][data-filter-value=""]')!
    expect(all.classList.contains('is-active')).toBe(false)
  })

  it('нажатие «Все» гасит остальные и показывает всё', () => {
    boot(HTML)
    clickChip('rooms', '1')
    clickChip('rooms', '')
    expect(visibleIds()).toEqual(['a', 'b', 'c'])
    expect(document.querySelector('[data-filter-value="1"]')!.classList.contains('is-active')).toBe(false)
  })

  it('снятие последнего выбора возвращает «Все» — группа не остаётся выключенной', () => {
    boot(HTML)
    clickChip('rooms', '1')
    clickChip('rooms', '1')
    const all = document.querySelector('[data-filter-field="rooms"][data-filter-value=""]')!
    expect(all.classList.contains('is-active')).toBe(true)
  })
})

describe('поля складываются по И', () => {
  it('комнатность и цена сужают выдачу вместе', () => {
    boot(
      `${chip('rooms', '', { active: true })}${chip('rooms', '2')}${chip('rooms', '3')}` +
      `${rangeInput('price', 'min')}${CARDS}`
    )
    clickChip('rooms', '2')
    setRange('price', 'min', '1500')
    // b проходит по комнатности, но не по цене — выдача пуста.
    expect(visibleIds()).toEqual([])
  })

  it('пустая выдача показывает заглушку и ноль в счётчике', () => {
    boot(
      `<span data-filter-count></span><p data-filter-empty>Ничего</p>` +
      `${rangeInput('price', 'min')}${CARDS}`
    )
    setRange('price', 'min', '99999')
    expect(visibleIds()).toEqual([])
    expect(document.querySelector('[data-filter-count]')!.textContent).toBe('0')
    expect((document.querySelector('[data-filter-empty]') as HTMLElement).hidden).toBe(false)
  })
})

describe('сброс', () => {
  it('возвращает чипсы к «Все», очищает диапазоны и показывает всё', () => {
    boot(
      `<button data-filter-reset>Сбросить</button>` +
      `${chip('rooms', '', { active: true })}${chip('rooms', '2')}` +
      `${rangeInput('price', 'min')}${CARDS}`
    )
    clickChip('rooms', '2')
    setRange('price', 'min', '1200')
    expect(visibleIds()).toEqual(['b'])

    ;(document.querySelector('[data-filter-reset]') as HTMLElement).click()

    expect(visibleIds()).toEqual(['a', 'b', 'c'])
    expect((document.querySelector('input[data-filter-bound="min"]') as HTMLInputElement).value).toBe('')
    const all = document.querySelector('[data-filter-field="rooms"][data-filter-value=""]')!
    expect(all.classList.contains('is-active')).toBe(true)
  })
})

describe('устойчивость', () => {
  it('повторная инициализация не вешает второй обработчик', () => {
    boot(`${chip('rooms', '', { active: true })}${chip('rooms', '2')}${CARDS}`)
    ;(window as any).ghPlanFilter.initAll()
    clickChip('rooms', '2')
    // При двойном обработчике клик отработал бы дважды и снял бы выбор.
    expect(visibleIds()).toEqual(['b'])
  })

  it('прячет через hidden, а не style.display — карточка может быть грид-ячейкой', () => {
    boot(`${rangeInput('price', 'min')}${CARDS}`)
    setRange('price', 'min', '99999')
    const first = document.querySelector('[data-card="a"]') as HTMLElement
    expect(first.hidden).toBe(true)
    expect(first.style.display).toBe('')
  })

  it('сообщает о смене выдачи событием', () => {
    boot(`${rangeInput('price', 'min')}${CARDS}`)
    let seen = -1
    document.querySelector('[data-filter-root]')!
      .addEventListener('planfilter:change', (e) => {
        seen = (e as CustomEvent).detail.visible
      })
    setRange('price', 'min', '1500')
    expect(seen).toBe(1)
  })

  it('контейнер без карточек не роняет рантайм', () => {
    boot(`${chip('rooms', '', { active: true })}`)
    expect(document.querySelector('[data-filter-root]')!.getAttribute('data-filter-visible')).toBe('0')
  })
})
