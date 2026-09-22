/**
 * Перевод секции «Выбрать» на карточки типов планировок.
 *
 * Фикстура повторяет форму реального блока «Complex choice»: грид с одним
 * шаблоном карточки, вложенные повторители обложки и акций, две панели
 * фильтра и скрипт блока. Проверяется и то, что меняется, и то, что остаётся
 * нетронутым: молчаливая потеря плейсхолдера превращается движком в пустую
 * строку, а не в ошибку, поэтому ловить её надо здесь.
 */
import {
  migrateChoiceStructure,
  migrateGlobalJs,
  MigrationError,
  StructureNode,
} from '../scripts/choiceToPlanTypes'

/**
 * Фикстура намеренно содержит комментарий ВЫШЕ функции matches().
 *
 * Первая версия регулярки описывала необязательный комментарий перед `if` как
 * `\\/\\*[\\s\\S]*?\\*\\/`. Ленивый квантификатор не обязан останавливаться на
 * своём `*​/` — при неудаче он растягивается до следующего, поэтому совпадение
 * начиналось с первого комментария в файле и съедало весь код между ними.
 * На реальном блоке это вырезало бы ~30 КБ скрипта. Без раннего комментария
 * тест этого не ловит.
 */
const GLOBAL_JS = `(function () {
  /* Тулбар и грид ищем один раз: узлы живут столько же, сколько страница. */
  var toolbar = section.querySelector('.apartment-toolbar');
  var grid = section.querySelector('.apartments-grid');
  if (!toolbar || !grid) return;

  var triggers = toolbar.querySelectorAll('.filter-trigger[data-panel]');
  var panels = toolbar.querySelectorAll('.filter-panel');

  function matches(card) {
    for (var field in selected) {
      var set = selected[field];
      if (!set || !set.length) continue;
      var raw = card.getAttribute('data-' + field);
      if (raw === null) return false;
      /* Комнатность: чип «4+» покрывает всё от четырёх и выше. */
      if (field === 'rooms') {
        var n = Number(raw);
        var hit = set.some(function (v) { return v === '4' ? n >= 4 : n === Number(v); });
        if (!hit) return false;
      } else if (set.indexOf(raw) === -1) {
        return false;
      }
    }
    var price = Number(card.getAttribute('data-price'));
    return true;
  }
})();`

function chip(value: string, filter: string): StructureNode {
  return {
    tagName: 'button',
    content: value,
    attributes: { type: 'button', 'data-value': value, 'data-filter': filter },
  }
}

function fixture(): StructureNode {
  return {
    tagName: 'section',
    attributes: { class: 'detail-section', id: 'choice' },
    metadata: { globalJs: GLOBAL_JS },
    children: [
      {
        tagName: 'div',
        attributes: { class: 'apartment-toolbar' },
        children: [
          {
            tagName: 'div',
            attributes: { class: 'filter-main' },
            children: [
              { tagName: 'button', content: 'Комнатность ⌄', attributes: { class: 'filter-trigger', 'data-panel': 'rooms' } },
              { tagName: 'button', content: 'Класс ⌄', attributes: { class: 'filter-trigger', 'data-panel': 'apartmentClass' } },
            ],
          },
          {
            tagName: 'div',
            attributes: { class: 'filter-panel', 'data-panel': 'rooms' },
            children: [
              {
                tagName: 'div',
                attributes: { class: 'filter-group' },
                children: [
                  { tagName: 'h3', content: 'Комнатность' },
                  {
                    tagName: 'div',
                    attributes: { class: 'chip-row', 'data-filter-group': 'rooms' },
                    children: [chip('1', 'rooms'), chip('2', 'rooms'), chip('3', 'rooms'), chip('4+', 'rooms')],
                  },
                ],
              },
            ],
          },
          {
            tagName: 'div',
            attributes: { class: 'filter-panel', 'data-panel': 'apartmentClass' },
            children: [
              {
                tagName: 'div',
                attributes: { class: 'filter-group' },
                children: [
                  { tagName: 'h3', content: 'Класс жилья' },
                  {
                    tagName: 'div',
                    attributes: { class: 'chip-row', 'data-filter-group': 'apartmentClass' },
                    _repeat: { source: 'item.apartmentClasses' },
                    children: [chip('{{$}}', 'apartmentClass')],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        tagName: 'div',
        attributes: { class: 'apartments-grid' },
        _repeat: { source: 'item.apartments' },
        children: [
          {
            tagName: 'article',
            attributes: {
              class: 'apartment-card',
              'data-price': '{{$.price}}',
              'data-rooms': '{{$.rooms}}',
              'data-deadline': '{{$.deadline}}',
              'data-plan-images': '{{$.planImage}}',
              'data-apartmentClass': '{{$.apartmentClass}}',
            },
            children: [
              {
                tagName: 'div',
                attributes: { class: 'apartment-card-body' },
                children: [
                  { tagName: 'h3', content: '{{$.title}}' },
                  {
                    tagName: 'div',
                    attributes: { class: 'apartment-badges' },
                    children: [
                      { tagName: 'span', content: '{{$.apartmentClass}}' },
                      { tagName: 'span', content: '{{$.badges.0}}' },
                    ],
                  },
                  {
                    tagName: 'div',
                    attributes: { class: 'plan-visual' },
                    _repeat: { source: '$.planImages' },
                    children: [
                      { tagName: 'div', styles: { properties: { backgroundImage: 'url("{{$.image}}")' } } },
                    ],
                  },
                  {
                    tagName: 'div',
                    attributes: { class: 'apartment-price' },
                    children: [
                      { tagName: 'span', content: '{{$.priceFormatted}}' },
                      { tagName: 'span', attributes: { class: 'old-price' }, content: '{{$.oldPriceFormatted}}' },
                    ],
                  },
                  {
                    tagName: 'div',
                    attributes: { class: 'apartment-meta' },
                    children: [
                      { tagName: 'span', content: '{{item.name}}' },
                      { tagName: 'span', content: '{{$.meta}}' },
                    ],
                  },
                ],
              },
              {
                tagName: 'div',
                _repeat: { source: '$.offers' },
                children: [{ tagName: 'div', attributes: { class: 'apartment-offer' } }],
              },
            ],
          },
        ],
      },
    ],
  }
}

/** Первый узел дерева, удовлетворяющий предикату. */
function find(root: StructureNode, pred: (n: StructureNode) => boolean): StructureNode | undefined {
  if (pred(root)) return root
  for (const child of root.children ?? []) {
    const hit = find(child, pred)
    if (hit) return hit
  }
  return undefined
}

function findAll(root: StructureNode, pred: (n: StructureNode) => boolean): StructureNode[] {
  const out: StructureNode[] = []
  const go = (n: StructureNode): void => {
    if (pred(n)) out.push(n)
    for (const c of n.children ?? []) go(c)
  }
  go(root)
  return out
}

const byClass = (name: string) => (n: StructureNode) => (n.attributes?.class ?? '').split(/\s+/).includes(name)

describe('migrateChoiceStructure — карточка', () => {
  const { structure, changes, alreadyMigrated } = migrateChoiceStructure(fixture())
  const card = find(structure, byClass('apartment-card'))!

  it('грид повторяется по типам планировок', () => {
    expect(find(structure, byClass('apartments-grid'))!._repeat).toEqual({ source: 'item.planTypes' })
    expect(alreadyMigrated).toBe(false)
    expect(changes.length).toBeGreaterThan(0)
  })

  it('фильтруемые атрибуты карточки переведены на поля типа', () => {
    expect(card.attributes!['data-price']).toBe('{{$.priceMin}}')
    expect(card.attributes!['data-plan-images']).toBe('{{$.imagesAttr}}')
    expect(card.attributes!['data-windowViews']).toBe('{{$.windowViewsAttr}}')
  })

  it('класс жилья с карточки убран — фильтровать по нему внутри проекта нечего', () => {
    expect(card.attributes).not.toHaveProperty('data-apartmentClass')
  })

  it('комнатность и срок сдачи остались: у типа планировки эти поля есть', () => {
    expect(card.attributes!['data-rooms']).toBe('{{$.rooms}}')
    expect(card.attributes!['data-deadline']).toBe('{{$.deadline}}')
  })

  it('бейджи: класс от комплекса, второй — диапазон площадей', () => {
    const badges = find(card, byClass('apartment-badges'))!.children!
    expect(badges[0].content).toBe('{{item.className}}')
    expect(badges[1].content).toBe('{{$.areaLabel}}')
  })

  it('обложка берётся из cover — массива 0..1, а не из planImages квартиры', () => {
    const visual = find(card, byClass('plan-visual'))!
    expect(visual._repeat).toEqual({ source: '$.cover' })
    // Плейсхолдер внутри шаблона обложки не трогаем: cover тоже отдаёт {image}.
    expect(visual.children![0].styles!.properties!.backgroundImage).toBe('url("{{$.image}}")')
  })

  it('цена — подпись «от …», зачёркнутая цена удалена', () => {
    const price = find(card, byClass('apartment-price'))!
    expect(price.children!.map((c) => c.content)).toEqual(['{{$.priceLabel}}'])
    expect(find(card, byClass('old-price'))).toBeUndefined()
  })

  it('мета показывает диапазон этажей', () => {
    const meta = find(card, byClass('apartment-meta'))!
    expect(meta.children!.map((c) => c.content)).toEqual(['{{item.name}}', '{{$.floorsLabel}}'])
  })

  it('блок акций удалён — акция принадлежит квартире, не типу', () => {
    expect(findAll(structure, (n) => n._repeat?.source === '$.offers')).toHaveLength(0)
    expect(find(card, byClass('apartment-offer'))).toBeUndefined()
  })

  it('заголовок карточки не тронут — title есть у обоих DTO', () => {
    expect(find(card, (n) => n.tagName === 'h3')!.content).toBe('{{$.title}}')
  })
})

describe('migrateChoiceStructure — тулбар', () => {
  const { structure } = migrateChoiceStructure(fixture())

  it('чипсы комнатности строятся по данным проекта, а не хардкодом', () => {
    const row = find(structure, (n) => n.attributes?.['data-filter-group'] === 'rooms')!
    expect(row._repeat).toEqual({ source: 'item.planRooms' })
    expect(row.children).toHaveLength(1)
    expect(row.children![0].content).toBe('{{$}}')
    expect(row.children![0].attributes!['data-value']).toBe('{{$}}')
    expect(row.children![0].attributes!['data-filter']).toBe('rooms')
  })

  it('фильтр класса жилья заменён фильтром вида из окна', () => {
    expect(findAll(structure, (n) => n.attributes?.['data-panel'] === 'apartmentClass')).toHaveLength(0)
    expect(findAll(structure, (n) => n.attributes?.['data-filter-group'] === 'apartmentClass')).toHaveLength(0)

    const trigger = find(structure, (n) => n.attributes?.['data-panel'] === 'windowViews' && byClass('filter-trigger')(n))!
    expect(trigger.content).toBe('Вид из окна ⌄')

    const row = find(structure, (n) => n.attributes?.['data-filter-group'] === 'windowViews')!
    expect(row._repeat).toEqual({ source: 'item.planViews' })
    expect(row.children![0].attributes!['data-filter']).toBe('windowViews')
  })

  it('заголовок группы переименован — иначе панель называлась бы «Класс жилья»', () => {
    expect(findAll(structure, (n) => n.content === 'Класс жилья')).toHaveLength(0)
    expect(findAll(structure, (n) => n.content === 'Вид из окна')).toHaveLength(1)
  })
})

describe('migrateChoiceStructure — идемпотентность и защита', () => {
  it('повторный запуск ничего не меняет', () => {
    const once = migrateChoiceStructure(fixture())
    const twice = migrateChoiceStructure(once.structure)
    expect(twice.alreadyMigrated).toBe(true)
    expect(twice.changes).toEqual([])
    expect(twice.structure).toBe(once.structure)
  })

  it('исходное дерево не мутируется', () => {
    const input = fixture()
    const copy = JSON.parse(JSON.stringify(input))
    migrateChoiceStructure(input)
    expect(input).toEqual(copy)
  })

  it('чужой источник повторителя — отказ, а не молчаливая правка', () => {
    const odd = fixture()
    find(odd, byClass('apartments-grid'))!._repeat = { source: 'item.somethingElse' }
    expect(() => migrateChoiceStructure(odd)).toThrow(MigrationError)
  })

  it('нет грида — отказ', () => {
    const noGrid = fixture()
    noGrid.children = [noGrid.children![0]]
    expect(() => migrateChoiceStructure(noGrid)).toThrow(MigrationError)
  })

  it('карточка без .apartment-badges — отказ, а не половинчатая миграция', () => {
    const broken = fixture()
    const body = find(broken, byClass('apartment-card-body'))!
    body.children = body.children!.filter((c) => !byClass('apartment-badges')(c))
    expect(() => migrateChoiceStructure(broken)).toThrow(MigrationError)
  })

  it('карточка без {{$.meta}} — отказ', () => {
    const broken = fixture()
    find(broken, byClass('apartment-meta'))!.children = [{ tagName: 'span', content: '{{item.name}}' }]
    expect(() => migrateChoiceStructure(broken)).toThrow(MigrationError)
  })
})

describe('migrateGlobalJs', () => {
  it('сравнивает множества через «|» и убирает спецслучай «4+»', () => {
    const changes: string[] = []
    const out = migrateGlobalJs(GLOBAL_JS, changes)
    expect(out).toContain("var values = raw.split('|');")
    expect(out).not.toContain("v === '4' ? n >= 4")
    expect(out).not.toContain("field === 'rooms'")
    expect(changes.some((c) => c.includes('matches()'))).toBe(true)
  })

  it('правит только спецслучай комнатности, остальной скрипт цел', () => {
    const out = migrateGlobalJs(GLOBAL_JS, [])
    // Код и комментарий ВЫШЕ matches() обязаны уцелеть: ленивый квантификатор
    // в регулярке однажды съел всё между первым комментарием файла и этим
    // местом. Проверяем именно границы, а не только результат подстановки.
    expect(out).toContain('/* Тулбар и грид ищем один раз')
    expect(out).toContain("var toolbar = section.querySelector('.apartment-toolbar');")
    expect(out).toContain("var triggers = toolbar.querySelectorAll('.filter-trigger[data-panel]');")
    expect(out).toContain("var panels = toolbar.querySelectorAll('.filter-panel');")
    // Код НИЖЕ заменённого куска — тоже.
    expect(out).toContain("var price = Number(card.getAttribute('data-price'));")
    expect(out).toContain('function matches(card) {')
  })

  it('прячет триггер, у которого в панели нет ни чипсов, ни диапазона', () => {
    const out = migrateGlobalJs(GLOBAL_JS, [])
    expect(out).toContain("trigger.style.display = 'none'")
    expect(out).toContain('.range-box')
  })

  it('повторный прогон не дублирует правки', () => {
    const once = migrateGlobalJs(GLOBAL_JS, [])
    const changes: string[] = []
    const twice = migrateGlobalJs(once, changes)
    expect(twice).toBe(once)
    expect(changes).toEqual([])
  })

  it('незнакомый скрипт — отказ, а не тихий пропуск', () => {
    expect(() => migrateGlobalJs('(function(){ var a = 1; })();', [])).toThrow(MigrationError)
  })

  // Регулярка может собрать синтаксически верный, но логически неверный код,
  // поэтому переписанную функцию исполняем и проверяем поведение.
  function compileMatches(selected: Record<string, string[]>) {
    const out = migrateGlobalJs(GLOBAL_JS, [])
    const start = out.indexOf('function matches(card)')
    const end = out.indexOf('\n  }\n', start) + '\n  }'.length
    const body = out.slice(start, end)
    return new Function('selected', `${body}\nreturn matches;`)(selected) as (card: unknown) => boolean
  }

  const card = (attrs: Record<string, string>) => ({ getAttribute: (k: string) => attrs[k] ?? null })

  it('попадает по любому значению множества', () => {
    const matches = compileMatches({ windowViews: ['бульвар'] })
    expect(matches(card({ 'data-windowViews': 'двор|бульвар', 'data-price': '100' }))).toBe(true)
    expect(matches(card({ 'data-windowViews': 'двор', 'data-price': '100' }))).toBe(false)
  })

  it('комнатность сравнивается точно — чипсы перечисляют всё, что есть в проекте', () => {
    const matches = compileMatches({ rooms: ['2'] })
    expect(matches(card({ 'data-rooms': '2', 'data-price': '100' }))).toBe(true)
    expect(matches(card({ 'data-rooms': '4', 'data-price': '100' }))).toBe(false)
  })

  it('выбрано несколько значений — попадает любое из них', () => {
    const matches = compileMatches({ rooms: ['1', '3'] })
    expect(matches(card({ 'data-rooms': '3', 'data-price': '100' }))).toBe(true)
    expect(matches(card({ 'data-rooms': '2', 'data-price': '100' }))).toBe(false)
  })

  it('карточка без атрибута выбранного фильтра отсеивается', () => {
    const matches = compileMatches({ windowViews: ['двор'] })
    expect(matches(card({ 'data-price': '100' }))).toBe(false)
  })

  it('ничего не выбрано — проходят все', () => {
    const matches = compileMatches({})
    expect(matches(card({ 'data-price': '100' }))).toBe(true)
  })
})
