/**
 * Перенос переводов узлов блоков из страниц в блоки: план и проверка
 * «каждая страница на каждом языке видит то же, что и до переноса».
 */
import { diffSnapshots, planBlockTranslations, snapshot, type BlockRow, type PageInput, type PageRow } from '../scripts/blockTranslations'

const page = (id: string, extra: object[] = []): PageInput => ({
  id,
  expanded: {
    id: `${id}-root`,
    children: [
      { id: `${id}-nav`, metadata: { linkedBlockId: 'nav' }, children: [{ id: 'nav-link' }, { id: 'nav-cta' }] },
      { id: `${id}-title` },
      ...extra,
    ],
  },
})
let seq = 0
const row = (pageId: string, nodeId: string, value: string, locale = 'uz', status = 'draft', field = 'content'): PageRow => ({
  id: `r${++seq}`,
  pageId,
  nodeId,
  field,
  locale,
  value,
  status,
})

const pages = [page('about'), page('contact')]

describe('planBlockTranslations', () => {
  it('копии перевода блока на разных страницах сводятся в одну строку блока', () => {
    const rows = [row('about', 'nav-link', 'Bosh sahifa'), row('contact', 'nav-link', 'Bosh sahifa', 'uz', 'published')]
    const plan = planBlockTranslations(pages, rows, [])
    expect(plan.inserts).toEqual([{ blockId: 'nav', nodeId: 'nav-link', field: 'content', locale: 'uz', value: 'Bosh sahifa', status: 'published' }])
    expect(plan.deletePageRowIds.sort()).toEqual(rows.map((r) => r.id).sort())
    expect(plan.perBlock).toEqual({ nav: 1 })
  })

  it('свои узлы, мета страницы, строки без узла — не трогаются', () => {
    const rows = [row('about', 'about-title', 'Sarlavha'), row('about', '__page__', 'Biz', 'uz', 'draft', 'meta:title'), row('about', 'gone', 'x')]
    const plan = planBlockTranslations(pages, rows, [])
    expect(plan.inserts).toEqual([])
    expect(plan.deletePageRowIds).toEqual([])
    expect(plan.untouched).toBe(3)
  })

  it('копии расходятся — конфликт: не переносится, копии остаются', () => {
    const rows = [row('about', 'nav-link', 'Bosh sahifa'), row('contact', 'nav-link', 'Asosiy')]
    const plan = planBlockTranslations(pages, rows, [])
    expect(plan.inserts).toEqual([])
    expect(plan.deletePageRowIds).toEqual([])
    expect(plan.conflicts).toMatchObject([{ blockId: 'nav', nodeId: 'nav-link', values: [{ pageId: 'about' }, { pageId: 'contact' }] }])
  })

  it('у блока перевод уже есть — копии просто уходят, вставки нет', () => {
    const existing: BlockRow[] = [{ blockId: 'nav', nodeId: 'nav-link', field: 'content', locale: 'uz', value: 'новый', status: 'draft' }]
    const rows = [row('about', 'nav-link', 'старая копия')]
    const plan = planBlockTranslations(pages, rows, existing)
    expect(plan.inserts).toEqual([])
    expect(plan.deletePageRowIds).toEqual([rows[0].id])
  })

  it('отметки «*» переносятся так же, как языки', () => {
    const plan = planBlockTranslations(pages, [row('about', 'nav-cta', 'same', '*')], [])
    expect(plan.inserts).toMatchObject([{ blockId: 'nav', locale: '*', value: 'same' }])
  })

  it('id узла в двух разных блоках на одной странице — неоднозначен, остаётся странице', () => {
    const ambiguous: PageInput = {
      id: 'mixed',
      expanded: {
        id: 'r',
        children: [
          { id: 'a', metadata: { linkedBlockId: 'block-a' }, children: [{ id: 'same-id' }] },
          { id: 'b', metadata: { linkedBlockId: 'block-b' }, children: [{ id: 'same-id' }] },
        ],
      },
    }
    const plan = planBlockTranslations([ambiguous], [row('mixed', 'same-id', 'x')], [])
    expect(plan.inserts).toEqual([])
    expect(plan.untouched).toBe(1)
  })
})

describe('snapshot / diffSnapshots — ничего не теряется и не меняется', () => {
  it('перенос по плану: потерь и подмен нет; перевод блока становится общим (gained)', () => {
    const rows = [
      row('about', 'nav-link', 'Bosh sahifa'),
      row('contact', 'nav-link', 'Bosh sahifa'),
      row('about', 'nav-cta', 'Contact', 'en'),
      row('about', 'about-title', 'Sarlavha'),
      row('contact', 'nav-cta', 'Aloqa'),
      row('about', 'nav-cta', 'Boglanish'), // конфликт с contact — остаётся в страницах
    ]
    const plan = planBlockTranslations(pages, rows, [])
    const deleted = new Set(plan.deletePageRowIds)
    const diff = diffSnapshots(snapshot(pages, rows, []), snapshot(pages, rows.filter((r) => !deleted.has(r.id)), plan.inserts))
    expect(diff.lost).toEqual([])
    expect(diff.changed).toEqual([])
    // en-перевод кнопки шапки был только на «О нас» — теперь он у блока и на «Контактах».
    expect(diff.gained).toEqual(['contact [en] nav-cta/content: null → "Contact"'])
  })

  it('проверка ловит потерю и подмену', () => {
    const rows = [row('about', 'about-title', 'Sarlavha'), row('about', 'nav-link', 'Bosh sahifa')]
    const before = snapshot(pages, rows, [])
    expect(diffSnapshots(before, snapshot(pages, [rows[1]], [])).lost).toEqual(['about [uz] about-title/content: "Sarlavha" → null'])
    const changed = diffSnapshots(
      before,
      snapshot(pages, [rows[0]], [{ blockId: 'nav', nodeId: 'nav-link', field: 'content', locale: 'uz', value: 'другое', status: 'draft' }])
    )
    expect(changed.changed).toEqual(['about [uz] nav-link/content: "Bosh sahifa" → "другое"'])
    expect(changed.gained).toEqual(['contact [uz] nav-link/content: null → "другое"'])
  })
})
