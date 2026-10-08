/**
 * Ядро новостей: языки, полнота перевода, доступность на языке и данные для
 * шаблонов CMS (карточка ленты и страница новости).
 *
 * Страница новости — шаблон-конструктор: одна шаблон-страница в редакторе CMS
 * повторяет `sections`, а внутри секции стоят заготовки всех типов, каждая
 * под своим повтором 0..1 (`text`, `photoText`, `sliderText`). Условий в
 * движке шаблонов нет — условность задаётся длиной массива: у секции
 * заполнен ровно один из трёх, и рисуется только эта заготовка.
 *
 * Языки: база — ru, переводы uz/en — overlay (NewsTranslation). На языке кроме
 * ru новость публикуется, только если язык отмечен (`publishOn`) И перевод
 * полный: заголовок, анонс и текст каждой секции. Стал неполным (добавили
 * секцию) — новость выпадает из языка до перевода, отметка остаётся.
 *
 * Всё здесь — чистые функции без БД.
 */
import { hasText, plainText } from './html'
import { dateLabel, isoDay } from './dates'
import { GalleryItem, MediaSlide, toSlides } from './mediaSlides'

export type Locale = 'ru' | 'uz' | 'en'
export const DEFAULT_LOCALE: Locale = 'ru'
export const SUPPORTED_LOCALES: Locale[] = ['ru', 'uz', 'en']
/** Языки, на которых новость публикуется по отметке. */
export const EXTRA_LOCALES: Locale[] = ['uz', 'en']

export function normalizeLocale(input?: string | null): Locale {
  const l = (input || '').toLowerCase()
  return (SUPPORTED_LOCALES as string[]).includes(l) ? (l as Locale) : DEFAULT_LOCALE
}

/** Каталог страниц новостей на сайте: /<язык>/<NEWS_BASE_PATH>/<slug>/. */
export const NEWS_BASE_PATH = 'news'

export type NewsStatus = 'draft' | 'published' | 'archived'
export type SectionType = 'text' | 'photoText' | 'sliderText' | 'block'
export type MediaSide = 'left' | 'right'
export const SECTION_TYPES: SectionType[] = ['text', 'photoText', 'sliderText', 'block']

/** Вид якоря блока данных CMS (backend services/dataAnchors.ts). */
export type BlockValueKind = 'text' | 'richtext' | 'image' | 'link'

/** Значение якоря секции-блока, как лежит в базе. */
export interface BlockValue {
  kind: BlockValueKind
  /** text/richtext/image — строка; link — {href, text}. */
  value: string | { href: string; text: string }
}

/**
 * Переводимая часть значения: текст, HTML, подпись ссылки. Картинка и адрес
 * ссылки — общие для всех языков. null — переводить нечего.
 */
export function translatableValue(v: BlockValue): string | null {
  if (v.kind === 'image') return null
  if (v.kind === 'link') return typeof v.value === 'object' ? v.value.text : null
  return typeof v.value === 'string' ? v.value : null
}

/** Блок тела новости, как лежит в базе. */
export interface NewsSection {
  /** Постоянный id: по нему привязан перевод текста. */
  id: string
  type: SectionType
  /** Очищенный HTML (services/html.ts). */
  html: string
  /** Фото (photoText — первое) или слайды (sliderText). */
  media: GalleryItem[]
  /** Сторона медиа относительно текста. */
  side: MediaSide
  /** type block: блок данных из библиотеки CMS. */
  blockId?: string
  /** type block: значения якорей блока по ключу. */
  values?: Record<string, BlockValue>
}

export interface NewsRow {
  id: string
  slug: string
  status: NewsStatus
  publishedAt: Date | null
  categoryKey: string | null
  tagKeys: string[]
  title: string
  lead: string
  cover: GalleryItem | null
  hero: GalleryItem[]
  sections: NewsSection[]
  publishOn: string[]
  createdAt: Date
}

export interface DictionaryRow {
  key: string
  nameRu: string
  nameUz: string
  nameEn: string
  order: number
  hidden: boolean
}

export interface TrRow {
  newsId: string
  locale: string
  field: string
  value: string
}

// --- Переводы ---

/** Переводимые поля новости; sections — json { "<id секции>": { html } | { values: { <ключ>: текст } } }. */
export const NEWS_TR_FIELDS = ['title', 'lead', 'sections'] as const

/** Текст новости на языке. */
export interface NewsText {
  title: string
  lead: string
  /** id секции → HTML. */
  sections: Record<string, string>
  /** id секции-блока → ключ якоря → переводимый текст (текст, HTML, подпись ссылки). */
  blocks: Record<string, Record<string, string>>
}

function baseText(news: NewsRow): NewsText {
  const sections: Record<string, string> = {}
  const blocks: Record<string, Record<string, string>> = {}
  for (const s of news.sections) {
    sections[s.id] = s.html
    if (s.type !== 'block') continue
    blocks[s.id] = {}
    for (const [key, v] of Object.entries(s.values ?? {})) {
      const text = translatableValue(v)
      if (text !== null) blocks[s.id][key] = text
    }
  }
  return { title: news.title, lead: news.lead, sections, blocks }
}

/** json переводов секций → HTML секций и тексты якорей секций-блоков. */
export function parseSectionTranslations(value: string | undefined): Pick<NewsText, 'sections' | 'blocks'> {
  const out: Pick<NewsText, 'sections' | 'blocks'> = { sections: {}, blocks: {} }
  if (!value) return out
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object') return out
    for (const [id, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object') continue
      const { html, values } = entry as Record<string, unknown>
      if (typeof html === 'string') out.sections[id] = html
      if (values && typeof values === 'object') {
        out.blocks[id] = Object.fromEntries(Object.entries(values as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string'))
      }
    }
    return out
  } catch {
    return out
  }
}

/** Текст новости на языке: ru — база, остальные — только перевод (без фолбэка). */
export function textIn(news: NewsRow, translations: readonly TrRow[], locale: Locale): NewsText {
  if (locale === DEFAULT_LOCALE) return baseText(news)
  const rows = translations.filter((t) => t.newsId === news.id && t.locale === locale)
  const field = (name: string) => rows.find((t) => t.field === name)?.value
  return {
    title: (field('title') ?? '').trim(),
    lead: (field('lead') ?? '').trim(),
    ...parseSectionTranslations(field('sections')),
  }
}

/**
 * Чего не хватает в переводе: `title`, `lead`, `section:<номер с 1>`.
 * Требуется перевод только того, что есть в базе: пустой анонс или секция
 * без текста перевода не ждут. Для ru — всегда пусто.
 */
export function missingTranslation(news: NewsRow, translations: readonly TrRow[], locale: Locale): string[] {
  if (locale === DEFAULT_LOCALE) return []
  const text = textIn(news, translations, locale)
  const missing: string[] = []
  if (news.title.trim() && !text.title) missing.push('title')
  if (news.lead.trim() && !text.lead) missing.push('lead')
  news.sections.forEach((section, i) => {
    if (section.type === 'block') {
      // Секция-блок не переведена, пока не переведено хоть одно её значение с текстом.
      const own = text.blocks[section.id] ?? {}
      const untranslated = Object.entries(section.values ?? {}).some(([key, v]) => {
        const base = translatableValue(v)
        return base !== null && hasText(base) && !hasText(own[key])
      })
      if (untranslated) missing.push(`section:${i + 1}`)
      return
    }
    if (hasText(section.html) && !hasText(text.sections[section.id])) missing.push(`section:${i + 1}`)
  })
  return missing
}

/** Новость видна на языке: опубликована и, кроме ru, отмечена и переведена целиком. */
export function isAvailableIn(news: NewsRow, translations: readonly TrRow[], locale: Locale): boolean {
  if (news.status !== 'published' || !news.publishedAt) return false
  if (locale === DEFAULT_LOCALE) return true
  return news.publishOn.includes(locale) && missingTranslation(news, translations, locale).length === 0
}

// --- Данные для шаблонов ---

export interface DictionaryDTO {
  key: string
  name: string
}

export function dictionaryName(row: DictionaryRow, locale: Locale): string {
  const own = locale === 'uz' ? row.nameUz : locale === 'en' ? row.nameEn : row.nameRu
  return (own || '').trim() || row.nameRu
}

export interface NewsCardDTO {
  id: string
  slug: string
  lang: Locale
  /** Адрес страницы новости с языком: /ru/news/<slug>/. */
  url: string
  title: string
  lead: string
  /** День публикации по Ташкенту, YYYY-MM-DD. */
  date: string
  dateLabel: string
  /** Рубрика 0..1 — повтор бейджа в шаблоне. */
  category: DictionaryDTO[]
  categoryKey: string
  tags: DictionaryDTO[]
  /** Обложка 0..1: { image, position }. */
  cover: Array<{ image: string; position: string }>
}

export interface SectionDTO {
  id: string
  type: SectionType
  side: MediaSide
  text: Array<{ html: string }>
  photoText: Array<{ html: string; image: string; position: string; fit: string; side: MediaSide }>
  sliderText: Array<{ html: string; slides: MediaSlide[]; side: MediaSide }>
  /**
   * Секция-блок 0..1: блок данных CMS и значения его якорей JSON-строкой.
   * Шаблон кладёт их в data-slide-block / data-block-values; CMS при
   * публикации разворачивает блок и подставляет значения вместо `{{$.…}}`.
   */
  block: Array<{ blockId: string; valuesJson: string }>
}

export interface NewsDetailDTO extends NewsCardDTO {
  /** Слайды hero: одно фото — без стрелок, несколько — слайдер. */
  hero: MediaSlide[]
  sections: SectionDTO[]
}

export interface Dictionaries {
  categories: ReadonlyMap<string, DictionaryRow>
  tags: ReadonlyMap<string, DictionaryRow>
}

export function newsUrl(slug: string, locale: Locale): string {
  return `/${locale}/${NEWS_BASE_PATH}/${slug}/`
}

function coverOf(news: NewsRow): Array<{ image: string; position: string }> {
  const source = news.cover ? [news.cover] : news.hero
  const [first] = toSlides(source).filter((s) => !s.video)
  return first ? [{ image: first.image, position: first.position }] : []
}

export function buildCard(news: NewsRow, translations: readonly TrRow[], locale: Locale, dict: Dictionaries): NewsCardDTO {
  const text = textIn(news, translations, locale)
  const date = news.publishedAt ?? news.createdAt
  const category = news.categoryKey ? dict.categories.get(news.categoryKey) : undefined
  return {
    id: news.id,
    slug: news.slug,
    lang: locale,
    url: newsUrl(news.slug, locale),
    title: text.title,
    lead: text.lead,
    date: isoDay(date),
    dateLabel: dateLabel(date, locale),
    category: category ? [{ key: category.key, name: dictionaryName(category, locale) }] : [],
    categoryKey: category?.key ?? '',
    tags: news.tagKeys
      .map((key) => dict.tags.get(key))
      .filter((t): t is DictionaryRow => Boolean(t))
      .map((t) => ({ key: t.key, name: dictionaryName(t, locale) })),
    cover: coverOf(news),
  }
}

/**
 * Секция для шаблона: заполнен ровно один из text/photoText/sliderText.
 * «Фото + текст» без фото и «слайдер + текст» без слайдов рисуются как
 * текст — пустая рамка под картинку на странице хуже.
 */
export function buildSection(section: NewsSection, html: string, blockText: Record<string, string> = {}): SectionDTO {
  const slides = toSlides(section.media)
  const out: SectionDTO = { id: section.id, type: section.type, side: section.side, text: [], photoText: [], sliderText: [], block: [] }
  if (section.type === 'block') {
    if (section.blockId) out.block = [{ blockId: section.blockId, valuesJson: JSON.stringify(blockValuesIn(section, blockText)) }]
    return out
  }
  if (section.type === 'photoText' && slides.length > 0) {
    const [first] = slides
    out.photoText = [{ html, image: first.image, position: first.position, fit: first.fit, side: section.side }]
  } else if (section.type === 'sliderText' && slides.length > 0) {
    out.sliderText = [{ html, slides, side: section.side }]
  } else {
    out.text = [{ html }]
  }
  return out
}

/**
 * Значения якорей на языке страницы: { <ключ>: строка | {href, text} }.
 * Тексты — из перевода языка (для ru — база), картинки и адреса ссылок — общие.
 */
export function blockValuesIn(section: NewsSection, blockText: Record<string, string>): Record<string, string | { href: string; text: string }> {
  const out: Record<string, string | { href: string; text: string }> = {}
  for (const [key, v] of Object.entries(section.values ?? {})) {
    if (v.kind === 'image') out[key] = typeof v.value === 'string' ? v.value : ''
    else if (v.kind === 'link') out[key] = { href: typeof v.value === 'object' ? v.value.href : '', text: blockText[key] ?? '' }
    else out[key] = blockText[key] ?? ''
  }
  return out
}

export function buildDetail(news: NewsRow, translations: readonly TrRow[], locale: Locale, dict: Dictionaries): NewsDetailDTO {
  const text = textIn(news, translations, locale)
  return {
    ...buildCard(news, translations, locale, dict),
    hero: toSlides(news.hero),
    sections: news.sections.map((s) => buildSection(s, text.sections[s.id] ?? '', text.blocks[s.id] ?? {})),
  }
}

/** Сначала новые: по дате публикации, при равенстве — по дате создания. */
export function byNewest(a: NewsRow, b: NewsRow): number {
  const da = (a.publishedAt ?? a.createdAt).getTime()
  const db = (b.publishedAt ?? b.createdAt).getTime()
  return db - da || b.createdAt.getTime() - a.createdAt.getTime()
}

/** Текст новости для поиска: заголовок отдельно, тело — анонс и секции. */
export function searchText(news: NewsRow, translations: readonly TrRow[], locale: Locale): { title: string; body: string } {
  const text = textIn(news, translations, locale)
  const body = [
    text.lead,
    ...news.sections.map((s) => (s.type === 'block' ? Object.values(text.blocks[s.id] ?? {}).map(plainText).join(' ') : plainText(text.sections[s.id]))),
  ].join(' ')
  return { title: text.title, body }
}
