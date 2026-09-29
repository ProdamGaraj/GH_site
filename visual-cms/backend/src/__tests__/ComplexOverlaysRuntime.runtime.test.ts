/**
 * @jest-environment jsdom
 *
 * Модалка планировки в браузере: содержимое берётся из карточки группы
 * планировок — каждое поле из своего помеченного узла или атрибута карточки.
 * Цен на сайте нет: вместо стоимости — класс проекта.
 */
import { generateComplexOverlays } from '../services/ComplexOverlaysRuntime'

function mount(card: string, lang = 'ru', sectionAttrs = '') {
  const cards = `<section id="choice" ${sectionAttrs}><div class="apartments-grid">${card}</div></section>`
  const out = generateComplexOverlays(cards, lang)
  const script = out.slice(out.indexOf('<script>') + 8, out.lastIndexOf('</script>'))
  document.body.innerHTML = cards + out.slice(0, out.indexOf('<script>'))
  // eslint-disable-next-line no-new-func
  new Function(script)()
  const el = document.querySelector('.apartment-card') as HTMLElement
  ;(window as any).ghPlanModal.open(el)
  return (id: string) => document.getElementById(id)!.textContent
}

/** Карточка, как её отдаёт деплой шаблона проекта (блок «Выбрать»). */
function card({ cls = 'Бизнес', floors = 'этажи 2–12', deadline = '2 кв. 2028' } = {}): string {
  return `
    <article class="apartment-card" data-deadline="${deadline}">
      <div class="apartment-card-body">
        <h3>1-комн. 34.87 м²</h3>
        <div class="apartment-badges">
          <span data-apartment-class="">${cls}</span>
          <span>34.87 м²</span>
        </div>
        <div class="apartment-meta">
          <span data-card-project="">O'zMakon Business</span>
          <br>
          <span data-card-floors="">${floors}</span>
          <br>
          <span>подъезд 1</span>
        </div>
      </div>
    </article>`
}

function classFact(): HTMLElement {
  return document.getElementById('planModalClassFact') as HTMLElement
}

afterEach(() => {
  document.body.innerHTML = ''
  delete (window as any).ghPlanModal
  delete (window as any).ghLightbox
})

describe('факты окна — из карточки', () => {
  it('название, проект, класс, этажи и срок сдачи', () => {
    const text = mount(card())
    expect(text('planModalTitle')).toBe('1-комн. 34.87 м²')
    expect(text('planModalProject')).toBe("O'zMakon Business")
    expect(text('planModalClass')).toBe('Бизнес')
    expect(text('planModalFloor')).toBe('этажи 2–12')
    expect(text('planModalDeadline')).toBe('2 кв. 2028')
    expect(classFact().style.display).toBe('')
  })

  it('цены в окне нет: ни пункта «Стоимость», ни цены из карточки', () => {
    const text = mount(card().replace('</h3>', '</h3><div class="apartment-price"><span>от 1 UZS</span></div>'))
    expect(document.getElementById('planModalPrice')).toBeNull()
    expect(document.querySelector('.plan-modal')!.textContent).not.toMatch(/UZS|Стоимость/)
    expect(text('planModalClass')).toBe('Бизнес')
  })

  it('класса у проекта нет — пункт скрыт, а не пустой', () => {
    mount(card({ cls: '  ' }))
    expect(classFact().style.display).toBe('none')
  })

  it('следующая карточка с классом возвращает пункт', () => {
    mount(card({ cls: '' }))
    const second = document.createElement('div')
    second.innerHTML = card({ cls: 'Комфорт+' })
    document.body.appendChild(second)
    ;(window as any).ghPlanModal.open(second.querySelector('.apartment-card'))
    expect(classFact().style.display).toBe('')
    expect(document.getElementById('planModalClass')!.textContent).toBe('Комфорт+')
  })

  it('нет этажей и срока — «уточняется» на языке страницы', () => {
    expect(mount(card({ floors: '', deadline: '' }))('planModalFloor')).toBe('Этаж уточняется')
    expect(mount(card({ floors: '', deadline: '' }))('planModalDeadline')).toBe('Срок уточняется')
    expect(mount(card({ floors: '', deadline: '' }), 'uz')('planModalFloor')).toBe('Qavat aniqlanmoqda')
  })

  it('карточка, задеплоенная до разметки этажей, — «Этаж уточняется», а не текст меты', () => {
    const old = card().replace(' data-card-floors=""', '')
    expect(mount(old)('planModalFloor')).toBe('Этаж уточняется')
  })
})

describe('распроданный проект (data-sold-label секции «Выбрать»)', () => {
  it('«Распродано» — в надзаголовке окна, класс остаётся классом', () => {
    const text = mount(card(), 'ru', 'data-sold-label="Распродано"')
    expect(text('planModalEyebrow')).toBe('Планировка · Распродано')
    expect(text('planModalClass')).toBe('Бизнес')
  })

  it('на языке страницы', () => {
    expect(mount(card(), 'uz', 'data-sold-label="Sotilgan"')('planModalEyebrow')).toBe('Reja · Sotilgan')
  })

  it('пустой атрибут — проект продаётся: надзаголовок обычный', () => {
    expect(mount(card(), 'ru', 'data-sold-label=" "')('planModalEyebrow')).toBe('Планировка')
    expect(mount(card(), 'ru')('planModalEyebrow')).toBe('Планировка')
  })
})
