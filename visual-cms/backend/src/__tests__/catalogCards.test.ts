/**
 * Добавление карточек проектов в каталог на главной.
 *
 * Фикстура повторяет форму блока «Complexes»: грид с двумя карточками, у
 * каждой фон через CSS-переменную, бейдж класса, заголовок, описание, плашки
 * и ссылка «Подробнее».
 */
import {
  addCatalogCards,
  existingSlugs,
  makeIdFactory,
  CatalogError,
  CatalogCard,
  StructureNode,
} from '../scripts/catalogCards'

function card(slug: string, name: string, cls: string, dataClass: string, tags: string[]): StructureNode {
  return {
    id: `node-old-${slug}`,
    tagName: 'article',
    attributes: { class: 'project-card', 'data-href': `/complex/${slug}`, 'data-class': dataClass },
    children: [
      {
        id: `node-old-${slug}-img`,
        tagName: 'div',
        attributes: { class: 'project-image' },
        styles: { properties: { '--image': `url('https://example.test/${slug}.jpg')`, minHeight: '230px' } },
        children: [{ id: `node-old-${slug}-badge`, tagName: 'span', attributes: { class: 'project-class' }, content: cls }],
      },
      {
        id: `node-old-${slug}-body`,
        tagName: 'div',
        attributes: { class: 'project-body' },
        children: [
          { id: `node-old-${slug}-h3`, tagName: 'h3', content: name },
          { id: `node-old-${slug}-p`, tagName: 'p', content: 'старое описание' },
          {
            id: `node-old-${slug}-tags`,
            tagName: 'div',
            attributes: { class: 'project-tags' },
            children: tags.map((t, i) => ({
              id: `node-old-${slug}-tag${i}`,
              tagName: 'span',
              attributes: { class: 'tag-pill' },
              content: t,
            })),
          },
          {
            id: `node-old-${slug}-foot`,
            tagName: 'div',
            attributes: { class: 'project-foot' },
            children: [
              { id: `node-old-${slug}-price`, tagName: 'span', attributes: { class: 'project-price' }, content: 'Цена позапросу' },
              {
                id: `node-old-${slug}-more`,
                tagName: 'a',
                attributes: { class: 'project-more', href: `/complex/${slug}` },
                content: 'Подробнее',
              },
            ],
          },
        ],
      },
    ],
  }
}

function fixture(): StructureNode {
  return {
    id: 'node-root',
    tagName: 'section',
    attributes: { class: 'complexes-section' },
    children: [
      {
        id: 'node-grid',
        tagName: 'div',
        attributes: { class: 'project-grid' },
        children: [
          card('assalom-dostlik', "Assalom Do'stlik", 'Комфорт+', 'comfort', ['Акция', 'Ипотека']),
          card('ozmakon-business', "O'zMakon Business", 'Бизнес', 'business', ['Акция', 'Рассрочка']),
        ],
      },
    ],
  }
}

const HARIZMA: CatalogCard = {
  slug: 'harizma',
  name: 'Harizma',
  className: 'Бизнес',
  dataClass: 'business',
  intro: 'Жилой квартал бизнес-класса Golden House',
  image: '/media/e271d545.jpg',
  tags: ['Рассрочка', 'Ипотека'],
}

function find(root: StructureNode, pred: (n: StructureNode) => boolean): StructureNode | undefined {
  if (pred(root)) return root
  for (const c of root.children ?? []) {
    const hit = find(c, pred)
    if (hit) return hit
  }
  return undefined
}

const byClass = (name: string) => (n: StructureNode) =>
  (n.attributes?.class ?? '').split(/\s+/).includes(name)

function grid(structure: StructureNode): StructureNode {
  return find(structure, byClass('project-grid'))!
}

function cardBySlug(structure: StructureNode, slug: string): StructureNode {
  return grid(structure).children!.find((c) => c.attributes?.['data-href'] === `/complex/${slug}`)!
}

describe('existingSlugs', () => {
  it('читает слаги из data-href карточек', () => {
    expect(existingSlugs(grid(fixture()))).toEqual(['assalom-dostlik', 'ozmakon-business'])
  })
})

describe('addCatalogCards — добавление', () => {
  const { structure, added, skipped } = addCatalogCards(fixture(), [HARIZMA], makeIdFactory(111))
  const added0 = cardBySlug(structure, 'harizma')

  it('карточка появляется в конце грида', () => {
    expect(added).toEqual(['harizma'])
    expect(skipped).toEqual([])
    expect(grid(structure).children).toHaveLength(3)
    expect(grid(structure).children![2].attributes!['data-href']).toBe('/complex/harizma')
  })

  it('имя, описание и класс взяты из данных проекта', () => {
    expect(find(added0, (n) => n.tagName === 'h3')!.content).toBe('Harizma')
    expect(find(added0, (n) => n.tagName === 'p')!.content).toBe('Жилой квартал бизнес-класса Golden House')
    expect(find(added0, byClass('project-class'))!.content).toBe('Бизнес')
  })

  it('фон меняется через CSS-переменную, остальные стили шаблона целы', () => {
    const img = find(added0, byClass('project-image'))!
    expect(img.styles!.properties!['--image']).toBe("url('/media/e271d545.jpg')")
    expect(img.styles!.properties!.minHeight).toBe('230px')
  })

  it('ссылка ведёт на страницу проекта — и в data-href, и в href', () => {
    expect(added0.attributes!['data-href']).toBe('/complex/harizma')
    expect(find(added0, byClass('project-more'))!.attributes!.href).toBe('/complex/harizma')
  })

  it('data-class задаёт поведение фильтра каталога', () => {
    expect(added0.attributes!['data-class']).toBe('business')
  })

  it('плашки заменяются целиком, класс образца сохраняется', () => {
    const tags = find(added0, byClass('project-tags'))!
    expect(tags.children!.map((c) => c.content)).toEqual(['Рассрочка', 'Ипотека'])
    expect(tags.children!.every((c) => c.attributes!.class === 'tag-pill')).toBe(true)
  })

  it('незаданные части шаблона наследуются — цена осталась', () => {
    expect(find(added0, byClass('project-price'))!.content).toBe('Цена позапросу')
  })
})

describe('addCatalogCards — идентификаторы', () => {
  it('у клона все id новые: редактор адресует узлы по ним', () => {
    const { structure } = addCatalogCards(fixture(), [HARIZMA], makeIdFactory(222))
    const ids: string[] = []
    const collect = (n: StructureNode): void => {
      if (n.id) ids.push(n.id)
      ;(n.children ?? []).forEach(collect)
    }
    collect(structure)
    expect(new Set(ids).size).toBe(ids.length)
    const added = cardBySlug(structure, 'harizma')
    const addedIds: string[] = []
    const collectAdded = (n: StructureNode): void => {
      if (n.id) addedIds.push(n.id)
      ;(n.children ?? []).forEach(collectAdded)
    }
    collectAdded(added)
    expect(addedIds.every((id) => id.startsWith('node-222-'))).toBe(true)
  })
})

describe('addCatalogCards — идемпотентность и защита', () => {
  it('существующий слаг не дублируется', () => {
    const again: CatalogCard = { ...HARIZMA, slug: 'assalom-dostlik' }
    const { structure, added, skipped } = addCatalogCards(fixture(), [again], makeIdFactory(333))
    expect(added).toEqual([])
    expect(skipped).toEqual(['assalom-dostlik'])
    expect(grid(structure).children).toHaveLength(2)
  })

  it('повторный прогон ничего не меняет', () => {
    const once = addCatalogCards(fixture(), [HARIZMA], makeIdFactory(444))
    const twice = addCatalogCards(once.structure, [HARIZMA], makeIdFactory(555))
    expect(twice.added).toEqual([])
    expect(grid(twice.structure).children).toHaveLength(3)
  })

  it('исходное дерево не мутируется', () => {
    const input = fixture()
    const copy = JSON.parse(JSON.stringify(input))
    addCatalogCards(input, [HARIZMA], makeIdFactory(666))
    expect(input).toEqual(copy)
  })

  it('две карточки за один прогон', () => {
    const second: CatalogCard = { ...HARIZMA, slug: 'ozmahal', name: "O'zMahal" }
    const { added } = addCatalogCards(fixture(), [HARIZMA, second], makeIdFactory(777))
    expect(added).toEqual(['harizma', 'ozmahal'])
  })

  it('пустой список плашек убирает узел, а не оставляет пустую полосу', () => {
    const noTags: CatalogCard = { ...HARIZMA, tags: [] }
    const { structure } = addCatalogCards(fixture(), [noTags], makeIdFactory(888))
    expect(find(cardBySlug(structure, 'harizma'), byClass('project-tags'))).toBeUndefined()
  })

  it('без грида — отказ, а не молчаливый пропуск', () => {
    expect(() => addCatalogCards({ tagName: 'div' }, [HARIZMA])).toThrow(CatalogError)
  })

  it('грид без карточки-образца — отказ', () => {
    const empty: StructureNode = {
      tagName: 'div',
      attributes: { class: 'project-grid' },
      children: [],
    }
    expect(() => addCatalogCards(empty, [HARIZMA])).toThrow(CatalogError)
  })

  it('карточка-образец без заголовка — отказ', () => {
    const broken = fixture()
    const body = find(broken, byClass('project-body'))!
    body.children = body.children!.filter((c) => c.tagName !== 'h3')
    expect(() => addCatalogCards(broken, [HARIZMA])).toThrow(CatalogError)
  })

  it('карточка-образец без ссылки — отказ', () => {
    const broken = fixture()
    const foot = find(broken, byClass('project-foot'))!
    foot.children = foot.children!.filter((c) => !byClass('project-more')(c))
    expect(() => addCatalogCards(broken, [HARIZMA])).toThrow(CatalogError)
  })
})
