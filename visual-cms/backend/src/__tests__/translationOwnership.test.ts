/**
 * Владельцы переводов: узлы страницы и узлы библиотечных блоков; слияние
 * строк страницы и блока; «один текст для всех языков»; непереведённые поля.
 */
import {
  ALL_LOCALES,
  buildTranslationMap,
  isSameByDefault,
  isSameEffective,
  marksOf,
  mergeRows,
  missingEntries,
  resolveOwnership,
  type OwnershipNode,
} from '../services/translationOwnership'

/** Развёрнутое дерево: шапка (блок nav), секция страницы, слайдер с блоком-слайдом внутри блока hero. */
const tree: OwnershipNode = {
  id: 'root',
  children: [
    { id: 'nav-instance', metadata: { linkedBlockId: 'nav' }, children: [{ id: 'nav-logo' }, { id: 'nav-menu', children: [{ id: 'nav-link' }] }] },
    { id: 'page-title' },
    {
      id: 'hero-instance',
      metadata: { linkedBlockId: 'hero' },
      children: [
        { id: 'hero-title' },
        // Блок внутри блока: корень вложенного экземпляра — узел hero, потомки — promo.
        { id: 'promo-instance', metadata: { linkedBlockId: 'promo' }, children: [{ id: 'promo-text' }] },
      ],
      variations: { mobile: { specificChildren: [{ id: 'hero-mobile-note' }] } },
    },
  ],
}

describe('resolveOwnership', () => {
  const o = resolveOwnership(tree)

  it('узлы внутри блока — блоку, корень экземпляра — тому, кто его содержит', () => {
    expect(o.blockOf.get('nav-logo')).toBe('nav')
    expect(o.blockOf.get('nav-link')).toBe('nav')
    expect(o.blockOf.has('nav-instance')).toBe(false)
    expect(o.blockOf.has('page-title')).toBe(false)
    expect(o.blockOf.has('root')).toBe(false)
  })

  it('вложенный блок: его корень — внешнему блоку, потомки — внутреннему', () => {
    expect(o.blockOf.get('promo-instance')).toBe('hero')
    expect(o.blockOf.get('promo-text')).toBe('promo')
  })

  it('экранные вставки (variations) — тому же владельцу', () => {
    expect(o.blockOf.get('hero-mobile-note')).toBe('hero')
  })

  it('список блоков страницы', () => {
    expect(o.blockIds).toEqual(['nav', 'hero', 'promo'])
  })

  it('один блок дважды — один владелец, не неоднозначность', () => {
    const twice = resolveOwnership({
      id: 'r',
      children: [
        { id: 'a', metadata: { linkedBlockId: 'nav' }, children: [{ id: 'x' }] },
        { id: 'b', metadata: { linkedBlockId: 'nav' }, children: [{ id: 'x' }] },
      ],
    })
    expect(twice.blockOf.get('x')).toBe('nav')
    expect(twice.ambiguous.size).toBe(0)
  })

  it('id узла в двух разных блоках (копии блоков) — неоднозначен и остаётся странице', () => {
    const copies = resolveOwnership({
      id: 'r',
      children: [
        { id: 'a', metadata: { linkedBlockId: 'block-a' }, children: [{ id: 'same-id' }] },
        { id: 'b', metadata: { linkedBlockId: 'block-b' }, children: [{ id: 'same-id' }] },
      ],
    })
    expect(copies.blockOf.has('same-id')).toBe(false)
    expect([...copies.ambiguous]).toEqual(['same-id'])
  })

  it('пустое дерево — всё странице', () => {
    expect(resolveOwnership(null).blockOf.size).toBe(0)
  })
})

describe('mergeRows', () => {
  const o = resolveOwnership(tree)
  const row = (nodeId: string, value: string, field = 'content') => ({ nodeId, field, locale: 'uz', value, status: 'draft' })

  it('свои узлы — строки страницы; узлы блока — строки блока', () => {
    const merged = mergeRows(o, [row('page-title', 'Sarlavha')], [{ ...row('nav-link', 'Bosh sahifa'), blockId: 'nav' }])
    expect(merged.map((r) => [r.nodeId, r.value, r.source])).toEqual([
      ['nav-link', 'Bosh sahifa', 'block'],
      ['page-title', 'Sarlavha', 'page'],
    ])
  })

  it('перевод блока главнее копии в странице; копия — пока перевода блока нет', () => {
    const merged = mergeRows(
      o,
      [row('nav-link', 'старая копия'), row('nav-logo', 'только копия')],
      [{ ...row('nav-link', 'перевод блока'), blockId: 'nav' }]
    )
    expect(merged.find((r) => r.nodeId === 'nav-link')).toMatchObject({ value: 'перевод блока', source: 'block' })
    expect(merged.find((r) => r.nodeId === 'nav-logo')).toMatchObject({ value: 'только копия', source: 'legacy', blockId: 'nav' })
  })

  it('строка блока для узла, который на этой странице не его, не берётся', () => {
    // Копия блока с тем же id узла, но другим блоком: на странице узел nav-link — блока nav.
    const merged = mergeRows(o, [], [{ ...row('nav-link', 'чужой'), blockId: 'other' }])
    expect(merged).toEqual([])
  })

  it('строки страницы без узла в дереве (устаревшие) остаются как есть', () => {
    expect(mergeRows(o, [row('gone-node', 'x')], [])).toMatchObject([{ nodeId: 'gone-node', source: 'page' }])
  })
})

describe('«один текст для всех языков»', () => {
  it('по умолчанию общие — ссылки и медиа (в т.ч. экранные и page-переменные), текст — нет', () => {
    for (const f of ['href', 'src', 'src@mobile', 'poster', 'data-slide-video', 'bg:image', 'bg:image@tablet', 'media:s1:imageUrl', 'meta:ogImage']) {
      expect(isSameByDefault(f)).toBe(true)
    }
    for (const f of ['content', 'alt', 'title', 'placeholder', 'aria-label', 'data-title', 'meta:title', 'meta:description']) {
      expect(isSameByDefault(f)).toBe(false)
    }
  })

  it('отметка главнее умолчания', () => {
    expect(isSameEffective('content', 'same')).toBe(true)
    expect(isSameEffective('href', 'translate')).toBe(false)
    expect(isSameEffective('href', undefined)).toBe(true)
  })

  const marks = marksOf([
    { nodeId: 'phone', field: 'content', locale: ALL_LOCALES, value: 'same' },
    { nodeId: 'banner', field: 'src', locale: ALL_LOCALES, value: 'translate' },
    { nodeId: 'junk', field: 'content', locale: ALL_LOCALES, value: 'что-то' },
    { nodeId: 'phone', field: 'content', locale: 'uz', value: 'не отметка' },
  ])

  it('marksOf: только строки «*» с same | translate', () => {
    expect([...marks.entries()].length).toBe(2)
  })

  it('карта языка: поле «одно для всех» не переводится, остальное — как раньше (и медиа под язык)', () => {
    const map = buildTranslationMap(
      [
        { nodeId: 'phone', field: 'content', locale: 'uz', value: '+998 старый перевод' },
        { nodeId: 'title', field: 'content', locale: 'uz', value: 'Sarlavha' },
        { nodeId: 'banner', field: 'src', locale: 'uz', value: '/media/uz.png' },
        { nodeId: 'logo', field: 'src', locale: 'uz', value: '/media/logo-uz.png' },
      ],
      marks
    )
    expect(map).toEqual({
      title: { content: 'Sarlavha' },
      banner: { src: '/media/uz.png' },
      // Медиа без отметки «переводить» по умолчанию общее, но язык, где его заменили, — заменён.
      logo: { src: '/media/logo-uz.png' },
    })
  })
})

describe('missingEntries', () => {
  const entries = [
    { nodeId: 'title', field: 'content', value: 'Заголовок' },
    { nodeId: 'phone', field: 'content', value: '+998 78 150-11-11' },
    { nodeId: 'link', field: 'href', value: '/about' },
    { nodeId: 'banner', field: 'src', value: '/media/ru.png' },
    { nodeId: 'empty', field: 'content', value: 'Текст' },
  ]
  const marks = marksOf([
    { nodeId: 'phone', field: 'content', locale: ALL_LOCALES, value: 'same' },
    { nodeId: 'banner', field: 'src', locale: ALL_LOCALES, value: 'translate' },
  ])

  it('не переведено: нет перевода, пустой перевод, «переводить» без перевода', () => {
    const rows = [{ nodeId: 'empty', field: 'content', locale: 'uz', value: '   ' }]
    expect(missingEntries(entries, rows, marks).map((e) => e.nodeId)).toEqual(['title', 'banner', 'empty'])
  })

  it('переведённое и «одно для всех» — не в списке', () => {
    const rows = [
      { nodeId: 'title', field: 'content', locale: 'uz', value: 'Sarlavha' },
      { nodeId: 'banner', field: 'src', locale: 'uz', value: '/media/uz.png' },
      { nodeId: 'empty', field: 'content', locale: 'uz', value: 'Matn' },
    ]
    expect(missingEntries(entries, rows, marks)).toEqual([])
  })
})
