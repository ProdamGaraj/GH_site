/**
 * TranslationService с переводами у владельцев узлов: страница видит свои
 * строки и строки своих блоков, запись уходит владельцу, удаление языка
 * страницы не трогает блоки, «один текст для всех языков», непереведённые.
 *
 * Таблицы — в памяти (helpers/memoryRepos), блоки разворачивает настоящий
 * LinkedBlocksService.
 */
import { MemoryRepo, type Row } from './helpers/memoryRepos'

const repos: Record<string, MemoryRepo> = {
  Translation: new MemoryRepo('translations'),
  BlockTranslation: new MemoryRepo('block_translations'),
  Page: new MemoryRepo('pages'),
  Block: new MemoryRepo('blocks'),
  Language: new MemoryRepo('languages'),
}

jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: (entity: { name: string }) => {
      const repo = repos[entity.name]
      if (!repo) throw new Error(`нет таблицы для ${entity.name}`)
      return repo
    },
  },
}))

import { translationService } from '../services/TranslationService'

const NAV = '00000000-0000-4000-8000-00000000000a'
const PROMO = '00000000-0000-4000-8000-00000000000b'

const navBlock = { id: NAV, name: 'Navigation', structure: { id: 'nav-root', children: [{ id: 'nav-link', content: 'Главная', attributes: { href: '/' } }] } }
const promoBlock = { id: PROMO, name: 'Promo', structure: { id: 'promo-root', children: [{ id: 'promo-text', content: 'Акция' }] } }

const pageWith = (id: string, slug: string, extra: Row[] = []): Row => ({
  id,
  slug,
  metadata: { title: `Страница ${slug}` },
  structure: {
    id: `${slug}-root`,
    children: [{ id: `${slug}-nav`, metadata: { linkedBlockId: NAV }, children: [] }, { id: `${slug}-title`, content: 'Заголовок' }, ...extra],
  },
})

const tr = (pageId: string, nodeId: string, value: string, locale = 'uz', field = 'content'): Row => ({ pageId, nodeId, field, locale, value, status: 'draft' })
const btr = (blockId: string, nodeId: string, value: string, locale = 'uz', field = 'content'): Row => ({ blockId, nodeId, field, locale, value, status: 'draft' })

beforeEach(() => {
  repos.Block.seed([navBlock, promoBlock].map((b) => ({ ...b })))
  repos.Page.seed([pageWith('p1', 'about'), pageWith('p2', 'contact', [{ id: 'promo-slot', metadata: { linkedBlockId: PROMO }, children: [] }])])
  repos.Translation.seed([])
  repos.BlockTranslation.seed([])
  repos.Language.seed([
    { id: 'l1', code: 'ru', isDefault: true, isActive: true, order: 0 },
    { id: 'l2', code: 'uz', isDefault: false, isActive: true, order: 1 },
    { id: 'l3', code: 'en', isDefault: false, isActive: true, order: 2 },
  ])
})

describe('чтение: страница видит свои строки и строки своих блоков', () => {
  it('getTranslationMap: перевод блока на каждой странице с блоком', async () => {
    repos.BlockTranslation.seed([btr(NAV, 'nav-link', 'Bosh sahifa')])
    repos.Translation.seed([tr('p1', 'about-title', 'Sarlavha')])
    expect(await translationService.getTranslationMap('p1', 'uz')).toEqual({ 'nav-link': { content: 'Bosh sahifa' }, 'about-title': { content: 'Sarlavha' } })
    expect(await translationService.getTranslationMap('p2', 'uz')).toEqual({ 'nav-link': { content: 'Bosh sahifa' } })
  })

  it('до переноса: копия перевода блока в странице видна, как раньше', async () => {
    repos.Translation.seed([tr('p1', 'nav-link', 'Bosh sahifa (копия)')])
    expect(await translationService.getTranslationMap('p1', 'uz')).toEqual({ 'nav-link': { content: 'Bosh sahifa (копия)' } })
    const rows = await translationService.getPageTranslations('p1', 'uz')
    expect(rows).toMatchObject([{ nodeId: 'nav-link', source: 'legacy', blockId: NAV }])
  })

  it('getPageTranslations помечает источник: page | block', async () => {
    repos.BlockTranslation.seed([btr(NAV, 'nav-link', 'Bosh sahifa')])
    repos.Translation.seed([tr('p1', 'about-title', 'Sarlavha')])
    const rows = await translationService.getPageTranslations('p1', 'uz')
    expect(rows.map((r) => [r.nodeId, r.source, r.blockId])).toEqual([
      ['about-title', 'page', undefined],
      ['nav-link', 'block', NAV],
    ])
  })

  it('getPageLocales: свои строки и строки блоков; отметки «*» — не язык', async () => {
    repos.BlockTranslation.seed([btr(NAV, 'nav-link', 'Home', 'en'), btr(NAV, 'nav-link', 'same', '*')])
    repos.Translation.seed([tr('p1', 'about-title', 'Sarlavha'), tr('p1', 'about-title', 'same', '*')])
    expect(await translationService.getPageLocales('p1')).toEqual(['en', 'uz'])
  })

  it('getPageLocales: перевод блока на чужом узле (другой блок с тем же id) не в счёт', async () => {
    repos.BlockTranslation.seed([btr(PROMO, 'nav-link', 'чужой', 'en')])
    expect(await translationService.getPageLocales('p1')).toEqual([])
  })
})

describe('запись: каждой строке — её владелец', () => {
  it('bulkUpsert раскладывает пачку: узел блока — блоку, свой — странице', async () => {
    await translationService.bulkUpsert('p1', 'uz', [
      { nodeId: 'nav-link', field: 'content', value: 'Bosh sahifa' },
      { nodeId: 'about-title', field: 'content', value: 'Sarlavha' },
    ])
    expect(repos.BlockTranslation.rows).toMatchObject([{ blockId: NAV, nodeId: 'nav-link', value: 'Bosh sahifa' }])
    expect(repos.Translation.rows).toMatchObject([{ pageId: 'p1', nodeId: 'about-title', value: 'Sarlavha' }])
    // Перевод шапки, сделанный на «О нас», виден и на «Контактах».
    expect(await translationService.getTranslationMap('p2', 'uz')).toEqual({ 'nav-link': { content: 'Bosh sahifa' } })
  })

  it('правка перевода блока: обновляет строку блока, копия в странице больше не решает', async () => {
    repos.Translation.seed([tr('p1', 'nav-link', 'старая копия')])
    await translationService.upsertOne('p1', 'uz', 'nav-link', 'content', 'новый перевод')
    expect(await translationService.getTranslationMap('p1', 'uz')).toEqual({ 'nav-link': { content: 'новый перевод' } })
    await translationService.upsertOne('p2', 'uz', 'nav-link', 'content', 'ещё новее')
    expect(repos.BlockTranslation.rows).toHaveLength(1)
    expect(repos.BlockTranslation.rows[0].value).toBe('ещё новее')
  })

  it('bulkUpsertBatched считает вставки/обновления/без изменений по всем владельцам', async () => {
    repos.BlockTranslation.seed([btr(NAV, 'nav-link', 'Bosh sahifa')])
    const r = await translationService.bulkUpsertBatched('p1', 'uz', [
      { nodeId: 'nav-link', field: 'content', value: 'Bosh sahifa' },
      { nodeId: 'about-title', field: 'content', value: 'Sarlavha' },
      { nodeId: 'nav-link', field: 'href', value: '/uz/' },
    ])
    expect(r).toEqual({ inserted: 2, updated: 0, unchanged: 1 })
  })

  it('copyTranslations: копия языка уходит тем же владельцам', async () => {
    repos.BlockTranslation.seed([btr(NAV, 'nav-link', 'Bosh sahifa')])
    repos.Translation.seed([tr('p1', 'about-title', 'Sarlavha')])
    await translationService.copyTranslations('p1', 'uz', 'en')
    expect(repos.BlockTranslation.rows.filter((r) => r.locale === 'en')).toHaveLength(1)
    expect(repos.Translation.rows.filter((r) => r.locale === 'en')).toHaveLength(1)
  })
})

describe('удаление', () => {
  it('deleteOne перевода блока убирает и его копии в страницах с блоком', async () => {
    repos.BlockTranslation.seed([btr(NAV, 'nav-link', 'Bosh sahifa')])
    repos.Translation.seed([tr('p1', 'nav-link', 'копия 1'), tr('p2', 'nav-link', 'копия 2'), tr('p1', 'about-title', 'Sarlavha')])
    expect(await translationService.deleteOne('p1', 'uz', 'nav-link', 'content')).toBe(true)
    expect(repos.BlockTranslation.rows).toEqual([])
    expect(repos.Translation.rows.map((r) => r.nodeId)).toEqual(['about-title'])
    expect(await translationService.getTranslationMap('p2', 'uz')).toEqual({})
  })

  it('deleteOne своего узла — только строка страницы', async () => {
    repos.Translation.seed([tr('p1', 'about-title', 'Sarlavha'), tr('p2', 'about-title', 'другая страница')])
    await translationService.deleteOne('p1', 'uz', 'about-title', 'content')
    expect(repos.Translation.rows).toMatchObject([{ pageId: 'p2' }])
  })

  it('deleteLocale страницы: только её узлы; перевод блока и копии блока остаются', async () => {
    repos.BlockTranslation.seed([btr(NAV, 'nav-link', 'Bosh sahifa')])
    repos.Translation.seed([tr('p1', 'about-title', 'Sarlavha'), tr('p1', 'nav-link', 'копия'), tr('p1', 'about-title', 'Title', 'en')])
    expect(await translationService.deleteLocale('p1', 'uz')).toBe(1)
    expect(repos.BlockTranslation.rows).toHaveLength(1)
    expect(repos.Translation.rows.map((r) => `${r.nodeId}/${r.locale}`).sort()).toEqual(['about-title/en', 'nav-link/uz'])
  })
})

describe('«один текст для всех языков» и непереведённые', () => {
  it('отметка на узле блока ставится блоку и действует на всех его страницах', async () => {
    repos.BlockTranslation.seed([btr(NAV, 'nav-link', 'Bosh sahifa')])
    await translationService.setSameMark('p1', 'nav-link', 'content', 'same')
    expect(repos.BlockTranslation.rows).toContainEqual(expect.objectContaining({ blockId: NAV, locale: '*', value: 'same' }))
    // Перевод не удалён, но не применяется: на всех языках — текст основного.
    expect(await translationService.getTranslationMap('p2', 'uz')).toEqual({})
    await translationService.setSameMark('p2', 'nav-link', 'content', 'default')
    expect(await translationService.getTranslationMap('p1', 'uz')).toEqual({ 'nav-link': { content: 'Bosh sahifa' } })
  })

  it('getOverview: владелец, отметки, непереведённые; ссылки по умолчанию общие', async () => {
    repos.Page.rows.push({ id: 'pp', slug: 'promo-page', structure: { id: 'r', children: [{ id: 'slot', metadata: { linkedBlockId: PROMO }, children: [] }] } })
    repos.Translation.seed([tr('p2', 'contact-title', 'Sarlavha')])
    const o = await translationService.getOverview('p2', 'uz')
    const byKey = Object.fromEntries(o.entries.map((e) => [`${e.nodeId}/${e.field}`, e]))
    expect(byKey['contact-title/content']).toMatchObject({ owner: { kind: 'page' }, translation: 'Sarlavha', missing: false })
    expect(byKey['nav-link/content']).toMatchObject({ owner: { kind: 'block', blockId: NAV, blockName: 'Navigation', pageCount: 2 }, missing: true })
    expect(byKey['nav-link/href']).toMatchObject({ same: true, sameByDefault: true, missing: false })
    expect(byKey['promo-text/content'].owner).toMatchObject({ kind: 'block', blockName: 'Promo', pageCount: 2 })
    expect(byKey['__page__/meta:title']).toMatchObject({ missing: true })
    expect(o.missing).toBe(3)
    expect(await translationService.countMissing('p2', 'uz')).toBe(3)
  })

  it('getProgress: все активные языки, кроме основного; «одно для всех» — переведено', async () => {
    repos.Translation.seed([tr('p1', 'about-title', 'Sarlavha'), tr('p1', '__page__', 'Biz haqimizda', 'uz', 'meta:title')])
    await translationService.setSameMark('p1', 'nav-link', 'content', 'same')
    const progress = await translationService.getProgress('p1')
    expect(progress.map((p) => [p.locale, p.translated, p.total])).toEqual([
      ['uz', 4, 4],
      ['en', 2, 4],
    ])
  })
})
