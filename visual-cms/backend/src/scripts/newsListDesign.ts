/**
 * Страница списка новостей: hero-панель из дизайна golden-house/news.html и
 * мобильная раскладка страницы. Карточки и фильтры ленты — свои, как были:
 *   - «News header» → hero-панель: фото во всю ширину с затемнением, пилюля
 *     «Новости», заголовок «События и обновления», подзаголовок;
 *   - лента выровнена по hero (та же ширина и поля), на телефоне — поля 8px,
 *     как у дизайна (NEWS_FEED_CSS v3, newsFeedBlock.ts);
 *   - встроенные отступы шапки раздела (180px по бокам — на телефоне они
 *     съедали экран) уходят вместе с прежней разметкой блока.
 *
 * Узлы с переводами сохраняют id: «Новости» (было заголовком) становится
 * пилюлей — перевод «Yangiliklar» остаётся верным; у подзаголовка текст
 * новый — перевод обновляется (HERO_TRANSLATIONS).
 *
 * Чистые функции; запись — setup-news-pages.ts. Всё идемпотентно.
 */
import { MigrationError, StructureNode, makeNode } from './choiceToPlanTypes'

// --- Hero ---

export const NEWS_HERO_CLASS = 'news-hero'
/** Узлы прежнего «News header», которые переходят в hero со своими переводами. */
export const HERO_PILL_ID = 'node-1782723530070-shrr44ypm'
export const HERO_LEAD_ID = 'node-1782723530070-1lypzefe5'
export const HERO_CONTENT_ID = 'node-1782723530070-mp50aok3p'
export const HERO_TITLE_ID = 'news-hero-title'

export const HERO_TEXT = {
  pill: 'Новости',
  title: 'События и обновления',
  lead: 'Новости проектов, ход строительства, новые партнерства и важные сообщения для покупателей.',
}

/** Переводы новых текстов hero (узел → язык → текст). */
export const HERO_TRANSLATIONS: Array<{ nodeId: string; locale: string; value: string }> = [
  { nodeId: HERO_TITLE_ID, locale: 'uz', value: 'Voqealar va yangilanishlar' },
  { nodeId: HERO_LEAD_ID, locale: 'uz', value: 'Loyihalar yangiliklari, qurilish jarayoni, yangi hamkorliklar va xaridorlar uchun muhim xabarlar.' },
  { nodeId: HERO_TITLE_ID, locale: 'en', value: 'Events and updates' },
  { nodeId: HERO_LEAD_ID, locale: 'en', value: 'Project news, construction progress, new partnerships and important announcements for buyers.' },
  { nodeId: HERO_PILL_ID, locale: 'en', value: 'News' },
]

const HERO_CSS_HEAD = '/* ==== news-hero'
export const HERO_CSS_MARKER = `${HERO_CSS_HEAD} v1 ====`
/* Значения — из pages.css дизайна (.page, .wrap, .hero-panel, .pill, .hero-content); отступ сверху
   на планшете и телефоне — под нашу шапку (она ниже дизайна в одну строку). */
export const HERO_CSS = `${HERO_CSS_MARKER} */
/* Заголовок раздела новостей — hero-панель дизайна (golden-house/news.html). */
body:has(.news-hero) { background: #f4f1ea; }
.news-hero { position: relative; display: flex; align-items: flex-end; box-sizing: border-box; max-width: 1500px; min-height: clamp(400px, 42vw, 650px); margin: clamp(104px, 10vw, 148px) auto 0; padding: clamp(22px, 3vw, 44px); overflow: hidden; border-radius: 30px; color: #fff; background-color: #15181d; background-position: center; background-size: cover; background-repeat: no-repeat; box-shadow: 0 18px 54px rgba(0, 0, 0, .18); }
.news-hero::before { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(13, 15, 18, .08), rgba(13, 15, 18, .7)); pointer-events: none; }
.news-hero-content { position: relative; max-width: 790px; }
.news-hero-pill { display: inline-flex; min-height: 36px; align-items: center; box-sizing: border-box; padding: 8px 18px; border: 1px solid rgba(255, 255, 255, .3); border-radius: 999px; background: rgba(255, 255, 255, .16); color: rgba(255, 255, 255, .92); font-size: 13px; font-weight: 800; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.news-hero-title { margin: 16px 0 0; font-size: clamp(44px, 6vw, 96px); line-height: .96; letter-spacing: 0; font-weight: 700; color: #fff; }
.news-hero-lead { max-width: 620px; margin: 16px 0 0; color: rgba(255, 255, 255, .8); font-size: 16px; line-height: 1.58; }
@media (min-width: 0) { .news-hero { width: calc(100% - 2 * clamp(16px, 4vw, 54px)); } }
@media (max-width: 980px) { .news-hero { min-height: 520px; margin-top: 112px; } }
@media (max-width: 680px) { .news-hero { border-radius: 22px; width: calc(100% - 16px); margin-top: 96px; } }
@media (max-width: 560px) {
  .news-hero { min-height: 460px; padding: 20px; }
  .news-hero-title { font-size: 42px; line-height: 1; }
  .news-hero-lead { max-width: 100%; font-size: 15px; }
}
`

/** Фото hero по умолчанию — проект компании (меняется в редакторе, как любой фон). */
export const HERO_DEFAULT_IMAGE = '/media/d65851c0-0bcf-4901-87d7-4d91c77738c3.jpg'

function text(id: string, tagName: string, cls: string, content: string): StructureNode {
  return makeNode({ id, tagName, elementType: 'text', content, attributes: { class: cls } })
}

export interface DesignResult {
  structure: StructureNode
  changes: string[]
  alreadyMigrated: boolean
}

/**
 * «News header» → hero дизайна. Фото берётся из прежнего фона блока, если
 * он был, иначе HERO_DEFAULT_IMAGE. Уже hero — без правок.
 */
export function migrateNewsHeader(input: StructureNode): DesignResult {
  const css = String(input.metadata?.globalCss ?? '')
  if (css.includes(HERO_CSS_MARKER)) return { structure: input, changes: [], alreadyMigrated: true }
  const ids = new Set<string>()
  const visit = (n: StructureNode) => {
    if (n.id) ids.add(n.id)
    for (const c of n.children ?? []) visit(c)
  }
  visit(input)
  if (!ids.has(HERO_PILL_ID) || !ids.has(HERO_LEAD_ID)) {
    throw new MigrationError('«News header»: нет узлов заголовка и подзаголовка — блок изменился, перенос вслепую не делаю')
  }
  const oldBg = String(input.styles?.properties?.backgroundImage ?? '')
  const structure: StructureNode = {
    ...input,
    tagName: 'header',
    elementType: 'container',
    attributes: { ...(input.attributes ?? {}), class: NEWS_HERO_CLASS, 'data-header-theme': 'dark' },
    styles: { ...(input.styles ?? {}), properties: { backgroundImage: oldBg.includes('url(') ? oldBg : `url("${HERO_DEFAULT_IMAGE}")` } },
    metadata: { ...(input.metadata ?? {}), name: 'News header', globalCss: HERO_CSS },
    children: [
      makeNode({
        id: HERO_CONTENT_ID,
        tagName: 'div',
        elementType: 'container',
        attributes: { class: 'news-hero-content' },
        children: [
          text(HERO_PILL_ID, 'span', 'news-hero-pill', HERO_TEXT.pill),
          text(HERO_TITLE_ID, 'h1', 'news-hero-title', HERO_TEXT.title),
          text(HERO_LEAD_ID, 'p', 'news-hero-lead', HERO_TEXT.lead),
        ],
      }),
    ],
  }
  return {
    structure,
    changes: [
      'hero-панель дизайна: фото с затемнением, пилюля «Новости», заголовок «События и обновления», подзаголовок',
      'стили блока заменены (прежние — сетка «Новости + подзаголовок справа»)',
    ],
    alreadyMigrated: false,
  }
}

/**
 * Экземпляр «News header» на странице /news: атрибуты экземпляра перебивают
 * атрибуты блока (LinkedBlocksService), а у экземпляра — копия прежних
 * (class="news-head"). Без этой правки страница получала новые стили блока,
 * но старый класс — и hero не применялся вовсе. Класс и тема шапки
 * экземпляра приводятся к hero; прочие атрибуты не трогаются.
 */
export function alignHeroInstance(page: StructureNode, blockId: string): DesignResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(page))
  let changed = 0
  const visit = (n: StructureNode) => {
    if (n.metadata?.linkedBlockId === blockId) {
      const attrs = { ...(n.attributes ?? {}) }
      if (attrs.class !== NEWS_HERO_CLASS || attrs['data-header-theme'] !== 'dark') {
        n.attributes = { ...attrs, class: NEWS_HERO_CLASS, 'data-header-theme': 'dark' }
        changed++
      }
      return
    }
    for (const c of n.children ?? []) visit(c)
  }
  visit(structure)
  if (changed === 0) return { structure: page, changes: [], alreadyMigrated: true }
  return { structure, changes: [`экземпляр «News header» на странице: класс hero (атрибуты экземпляра перебивают блок) — ${changed}`], alreadyMigrated: false }
}
