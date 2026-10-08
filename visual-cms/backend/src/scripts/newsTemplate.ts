/**
 * Шаблон-страница «Новость» для коллекции новостей (/<язык>/news/<slug>/).
 *
 * У новостей нет фиксированной раскладки, поэтому шаблон — конструктор
 * (news-service, services/news.ts):
 *  - шапка и подвал — те же библиотечные блоки, что у страницы проекта;
 *  - hero — карусель по `item.hero` (одно фото — без стрелок: рантайм
 *    карусели прячет навигацию при одном слайде; тема шапки над фото — по
 *    яркости фото при публикации, как у слайдеров проектов);
 *  - шапка статьи: «← Все новости», рубрика, дата, заголовок, анонс;
 *  - тело — повтор по `item.sections`; в секции заготовки всех трёх типов,
 *    каждая под своим повтором 0..1 (`$.text`, `$.photoText`, `$.sliderText`):
 *    рисуется только заготовка типа блока. Текст — html-code узел: HTML уже
 *    очищен сервисом.
 *
 * Дальше шаблон дорабатывают в редакторе. Чистые функции; запись —
 * `setup-news-pages.ts`.
 */
import { StructureNode, makeNode } from './choiceToPlanTypes'

export const NEWS_TEMPLATE_SLUG = 'news-template'
export const NEWS_TEMPLATE_NAME = 'Новость (шаблон)'
/** Узел со статичным текстом, у которого есть перевод. */
export const NEWS_BACK_LINK_ID = 'news-back-link'
export const NEWS_BACK_LINK_TEXT: Record<'ru' | 'uz' | 'en', string> = {
  ru: '← Все новости',
  uz: '← Barcha yangiliklar',
  en: '← All news',
}

type Props = Record<string, string>
const contents: Props = { display: 'contents' }

function node(id: string, tagName: string, opts: Partial<StructureNode> & { cls?: string; props?: Props } = {}): StructureNode {
  const { cls, props, attributes, ...rest } = opts
  return makeNode({
    ...rest,
    id,
    tagName,
    elementType: String(rest.elementType ?? (rest.content !== undefined ? 'text' : 'container')),
    attributes: { ...(cls ? { class: cls } : {}), ...(attributes ?? {}) },
    styles: { properties: props ?? {} },
  })
}

/** Повтор с одним узлом-образцом, без своей раскладки. */
function repeat(id: string, source: string, child: StructureNode, name: string): StructureNode {
  return node(id, 'div', { props: contents, metadata: { name }, _repeat: { source }, children: [child] })
}

/** Текст блока: очищенный сервисом HTML как есть. */
function html(id: string, placeholder: string): StructureNode {
  return node(id, 'div', { elementType: 'html-code', cls: 'news-rich', content: placeholder })
}

/** Слайд карусели по {{$.image|video|position|fit}} текущего слайда. */
function slide(id: string, cls: string): StructureNode {
  return node(id, 'div', {
    cls,
    attributes: { 'data-carousel-slide': 'true', 'data-slide-video': '{{$.video}}', 'data-slide-fit': '{{$.fit}}' },
    props: { backgroundImage: 'url("{{$.image}}")', backgroundPosition: '{{$.position}}', backgroundSize: 'cover' },
  })
}

/** Лента карусели: повтор по слайдам, слайды — прямые дети (контракт CarouselRuntime). */
function track(id: string, source: string, child: StructureNode, name: string): StructureNode {
  return node(id, 'div', { cls: 'news-carousel-track', attributes: { 'data-carousel-track': 'true' }, metadata: { name }, _repeat: { source }, children: [child] })
}

function carouselControls(prefix: string): StructureNode[] {
  return [
    node(`${prefix}-prev`, 'button', { cls: 'news-carousel-prev', content: '‹', attributes: { type: 'button', 'data-carousel-prev': '', 'aria-label': 'Назад' } }),
    node(`${prefix}-next`, 'button', { cls: 'news-carousel-next', content: '›', attributes: { type: 'button', 'data-carousel-next': '', 'aria-label': 'Вперёд' } }),
    node(`${prefix}-dots`, 'div', {
      cls: 'news-carousel-dots',
      attributes: { 'data-carousel-dots': '' },
      children: [node(`${prefix}-dot`, 'button', { cls: 'news-carousel-dot', attributes: { type: 'button', 'data-carousel-dot': '' } })],
    }),
  ]
}

function hero(): StructureNode {
  return node('news-hero', 'section', {
    cls: 'news-hero',
    metadata: { name: 'Hero новости' },
    attributes: { 'data-carousel': 'true', 'data-carousel-effect': 'fade', 'data-carousel-autoplay': '6000', 'data-carousel-swipe': 'tablet,mobile' },
    children: [
      track('news-hero-track', 'item.hero', slide('news-hero-slide', 'news-hero-slide'), 'Слайды hero'),
      ...carouselControls('news-hero'),
    ],
  })
}

function articleHead(): StructureNode {
  return node('news-article-head', 'header', {
    cls: 'news-article-head',
    metadata: { name: 'Заголовок новости' },
    children: [
      node(NEWS_BACK_LINK_ID, 'a', { cls: 'news-back', content: NEWS_BACK_LINK_TEXT.ru, attributes: { href: '/news/' } }),
      node('news-article-meta', 'div', {
        cls: 'news-article-meta',
        children: [
          repeat('news-article-category', 'item.category', node('news-article-badge', 'span', { cls: 'news-badge', content: '{{$.name}}' }), 'Рубрика'),
          node('news-article-date', 'time', { cls: 'news-date', content: '{{item.dateLabel}}', attributes: { datetime: '{{item.date}}' } }),
        ],
      }),
      node('news-article-title', 'h1', { cls: 'news-article-title', content: '{{item.title}}' }),
      node('news-article-lead', 'p', { cls: 'news-article-lead', content: '{{item.lead}}' }),
    ],
  })
}

/**
 * Секция-блок: блок данных из библиотеки CMS. В слот кладутся id блока и
 * значения его якорей; при публикации CMS вставляет блок внутрь слота и
 * подставляет значения вместо `{{$.…}}` (DeployService.expandDataSlideBlocks).
 */
export const NEWS_BLOCK_VARIANT_ID = 'news-section-if-block'

export function blockSectionVariant(): StructureNode {
  const slot = node('news-section-block', 'div', {
    cls: 'news-section news-section--block',
    attributes: { 'data-slide-block': '{{$.blockId}}', 'data-block-values': '{{$.valuesJson}}' },
    metadata: { name: 'Блок из библиотеки (разворачивается при публикации)' },
  })
  return repeat(NEWS_BLOCK_VARIANT_ID, '$.block', slot, 'Блок из библиотеки')
}

/**
 * Шаблон, созданный до секций-блоков: дописывает заготовку блока к заготовкам
 * секций. Структура копируется; уже есть — без правок.
 */
export function addBlockSectionVariant(input: StructureNode): { structure: StructureNode; changed: boolean } {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  let variants: StructureNode | undefined
  const visit = (n: StructureNode) => {
    if (n.id === 'news-section-variants') variants = n
    for (const c of n.children ?? []) visit(c)
  }
  visit(structure)
  if (!variants) throw new Error('В шаблоне нет заготовок секций (news-section-variants)')
  if ((variants.children ?? []).some((c) => c.id === NEWS_BLOCK_VARIANT_ID)) return { structure: input, changed: false }
  variants.children = [...(variants.children ?? []), blockSectionVariant()]
  return { structure, changed: true }
}

function sections(): StructureNode {
  const text = node('news-section-text', 'div', {
    cls: 'news-section news-section--text',
    children: [html('news-section-text-html', '{{$.html}}')],
  })
  const photo = node('news-section-photo', 'div', {
    cls: 'news-section news-section--photo news-section--media-{{$.side}}',
    children: [
      node('news-section-photo-media', 'figure', {
        cls: 'news-section-media',
        children: [
          node('news-section-photo-img', 'img', {
            elementType: 'image',
            attributes: { src: '{{$.image}}', alt: '', loading: 'lazy' },
            props: { objectPosition: '{{$.position}}' },
          }),
        ],
      }),
      html('news-section-photo-html', '{{$.html}}'),
    ],
  })
  const slider = node('news-section-slider', 'div', {
    cls: 'news-section news-section--slider news-section--media-{{$.side}}',
    children: [
      node('news-section-slider-media', 'div', {
        cls: 'news-section-media news-section-carousel',
        attributes: { 'data-carousel': 'true', 'data-carousel-effect': 'slide', 'data-carousel-swipe': 'tablet,mobile' },
        children: [
          track('news-section-slider-track', '$.slides', slide('news-section-slide', 'news-section-slide'), 'Слайды блока'),
          ...carouselControls('news-section-slider'),
        ],
      }),
      html('news-section-slider-html', '{{$.html}}'),
    ],
  })
  // Каждая заготовка — под повтором 0..1: у блока заполнен ровно один массив.
  const variants = node('news-section-variants', 'div', {
    props: contents,
    metadata: { name: 'Блок (заготовки всех типов)' },
    children: [
      repeat('news-section-if-text', '$.text', text, 'Текст'),
      repeat('news-section-if-photo', '$.photoText', photo, 'Фото + текст'),
      repeat('news-section-if-slider', '$.sliderText', slider, 'Слайдер + текст'),
      blockSectionVariant(),
    ],
  })
  return node('news-body', 'div', {
    cls: 'news-body-sections',
    metadata: { name: 'Блоки новости' },
    _repeat: { source: 'item.sections' },
    children: [variants],
  })
}

export const NEWS_TEMPLATE_CSS = `/* Страница новости (шаблон коллекции «Новости»). */
.news-hero { position: relative; overflow: hidden; height: min(72vh, 720px); min-height: 360px; background: #0d0f12; }
.news-hero[data-carousel-count="0"] { display: none; }
.news-hero-slide, .news-section-slide { background-size: cover; background-repeat: no-repeat; }
.news-hero-slide { height: min(72vh, 720px); min-height: 360px; }
.news-carousel-prev, .news-carousel-next { position: absolute; top: 50%; z-index: 2; width: 48px; height: 48px; margin-top: -24px; border: 0; border-radius: 50%; background: rgba(255, 255, 255, .85); font-size: 28px; line-height: 1; cursor: pointer; }
.news-carousel-prev { left: 16px; }
.news-carousel-next { right: 16px; }
.news-carousel-dots { position: absolute; bottom: 16px; left: 0; right: 0; z-index: 2; display: flex; justify-content: center; gap: 8px; }
.news-carousel-dot { width: 8px; height: 8px; padding: 0; border: 0; border-radius: 50%; background: rgba(255, 255, 255, .5); cursor: pointer; }
.news-carousel-dot.active { background: #fff; }
.news-article-head { max-width: 860px; margin: 0 auto; padding: clamp(32px, 5vw, 64px) 20px 16px; }
.news-hero[data-carousel-count="0"] + .news-article-head { padding-top: 140px; }
.news-back { display: inline-block; margin-bottom: 20px; color: rgba(21, 24, 29, .6); font-weight: 700; text-decoration: none; }
.news-article-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.news-article-meta .news-badge { padding: 6px 12px; border-radius: 999px; background: var(--gold, #fdb82a); font-size: 13px; font-weight: 800; }
.news-article-meta .news-date { color: rgba(21, 24, 29, .5); font-size: 14px; font-weight: 700; }
.news-article-title { margin-top: 16px; font-size: clamp(32px, 4.4vw, 60px); line-height: 1.05; }
.news-article-lead { margin-top: 18px; color: rgba(21, 24, 29, .7); font-size: clamp(18px, 1.6vw, 22px); line-height: 1.5; }
.news-body-sections { display: grid; gap: clamp(32px, 5vw, 64px); max-width: 1180px; margin: 0 auto; padding: 24px 20px clamp(48px, 7vw, 96px); }
.news-section--text { max-width: 820px; margin: 0 auto; width: 100%; }
.news-section--block { width: 100%; }
.news-section--photo, .news-section--slider { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(24px, 4vw, 56px); align-items: center; }
.news-section--media-right .news-section-media { order: 2; }
.news-section-media { position: relative; overflow: hidden; margin: 0; border-radius: 24px; aspect-ratio: 4 / 3; background: rgba(21, 24, 29, .06); }
.news-section-media img { width: 100%; height: 100%; display: block; object-fit: cover; }
.news-section-slide { aspect-ratio: 4 / 3; }
.news-rich { font-size: 18px; line-height: 1.65; color: #15181d; }
.news-rich > * + * { margin-top: 1em; }
.news-rich h2 { font-size: clamp(24px, 2.4vw, 32px); line-height: 1.2; }
.news-rich h3 { font-size: 22px; line-height: 1.25; }
.news-rich ul, .news-rich ol { padding-left: 1.4em; }
.news-rich ul { list-style: disc; }
.news-rich ol { list-style: decimal; }
.news-rich blockquote { padding-left: 18px; border-left: 4px solid var(--gold, #fdb82a); color: rgba(21, 24, 29, .75); }
.news-rich a { color: inherit; text-decoration: underline; text-decoration-color: var(--gold, #fdb82a); text-underline-offset: 3px; }
@media (max-width: 767px) {
  .news-section--photo, .news-section--slider { grid-template-columns: 1fr; }
  .news-section--media-right .news-section-media { order: 0; }
  .news-rich { font-size: 17px; }
}
`

export interface TemplateParts {
  /** Экземпляры шапки и подвала со страницы проекта: их стили размещения. */
  navigation: StructureNode
  footer: StructureNode
  breakpoints: unknown[]
}

/** Экземпляр библиотечного блока: только ссылка и стили размещения, без детей. */
function instance(source: StructureNode, id: string): StructureNode {
  return makeNode({
    id,
    tagName: source.tagName ?? 'div',
    elementType: (source.elementType as string) ?? 'container',
    attributes: { ...(source.attributes ?? {}) },
    styles: JSON.parse(JSON.stringify(source.styles ?? { properties: {} })),
    variations: source.variations ? JSON.parse(JSON.stringify(source.variations)) : undefined,
    metadata: { name: (source.metadata?.name as string) ?? '', linkedBlockId: source.metadata?.linkedBlockId },
    children: [],
  })
}

export function buildNewsTemplate(parts: TemplateParts): StructureNode {
  if (!parts.navigation.metadata?.linkedBlockId || !parts.footer.metadata?.linkedBlockId) {
    throw new Error('Шапка и подвал должны быть экземплярами библиотечных блоков (metadata.linkedBlockId)')
  }
  return makeNode({
    id: 'news-template-root',
    tagName: 'div',
    elementType: 'container',
    styles: { properties: { display: 'flex', flexDirection: 'column', width: '100%', minHeight: '100vh' } },
    metadata: { name: NEWS_TEMPLATE_NAME, breakpoints: parts.breakpoints, globalCss: NEWS_TEMPLATE_CSS },
    children: [
      instance(parts.navigation, 'news-template-navigation'),
      hero(),
      articleHead(),
      sections(),
      instance(parts.footer, 'news-template-footer'),
    ],
  })
}

/** Повторы, у которых не ровно один узел-образец, — для проверок. */
export function brokenRepeats(root: StructureNode): string[] {
  const out: string[] = []
  const visit = (n: StructureNode) => {
    if (n._repeat && (n.children ?? []).length !== 1) out.push(String(n.id))
    for (const c of n.children ?? []) visit(c)
  }
  visit(root)
  return out
}
