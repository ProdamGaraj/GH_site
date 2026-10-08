/**
 * Ввод админки → данные новости. Чистые функции без БД.
 *
 *  - HTML секций и их переводов чистится здесь (services/html.ts) — до
 *    базы не доходит ничего, что не прошло белый список;
 *  - перевод секции, которой уже нет, отбрасывается; пустой перевод — это
 *    отсутствие строки, а не строка с пустым значением;
 *  - отметку языка (publishOn) можно ПОСТАВИТЬ только при полном переводе.
 *    Уже стоящая отметка не снимается, если перевод стал неполным: новость
 *    просто выпадает из языка до перевода (services/news.ts isAvailableIn).
 */
import { safeHref, sanitizeRichText } from './html'
import { BlockValue, EXTRA_LOCALES, Locale, NewsRow, NewsSection, TrRow, missingTranslation, parseSectionTranslations } from './news'
import type { TranslationsInput } from '../schemas/news.schema'

type SectionInput = Omit<NewsSection, 'html'> & { html?: string }

/**
 * Значения якорей секции-блока. Форматированный текст — через белый список;
 * текст и подпись — без разметки (на странице экранируются), адрес ссылки —
 * только безопасные схемы. Значение не своего вида отбрасывается.
 */
export function normalizeBlockValues(values: Record<string, BlockValue> | undefined): Record<string, BlockValue> {
  const out: Record<string, BlockValue> = {}
  for (const [key, v] of Object.entries(values ?? {})) {
    if (v.kind === 'link') {
      if (typeof v.value !== 'object' || v.value === null) continue
      out[key] = { kind: 'link', value: { href: safeHref(v.value.href), text: (v.value.text ?? '').trim() } }
    } else if (typeof v.value === 'string') {
      const value = v.kind === 'richtext' ? sanitizeRichText(v.value) : v.value.trim()
      out[key] = { kind: v.kind, value }
    }
  }
  return out
}

export function normalizeSections(input: readonly SectionInput[]): NewsSection[] {
  const seen = new Set<string>()
  const out: NewsSection[] = []
  for (const section of input) {
    // Повтор id сломал бы привязку перевода — второй блок с тем же id отбрасываем.
    if (seen.has(section.id)) continue
    seen.add(section.id)
    if (section.type === 'block') {
      out.push({
        id: section.id,
        type: 'block',
        html: '',
        media: [],
        side: 'right',
        blockId: section.blockId,
        values: normalizeBlockValues(section.values),
      })
      continue
    }
    out.push({
      id: section.id,
      type: section.type,
      html: sanitizeRichText(section.html),
      media: section.media ?? [],
      side: section.side === 'left' ? 'left' : 'right',
    })
  }
  return out
}

/** Строки переводов новости; секции — json {id: {html}} только для живых секций. */
export function translationRows(
  newsId: string,
  translations: TranslationsInput,
  sections: readonly NewsSection[]
): TrRow[] {
  const rows: TrRow[] = []
  const sectionIds = new Set(sections.filter((s) => s.type !== 'block').map((s) => s.id))
  const blockSections = new Map(sections.filter((s) => s.type === 'block').map((s) => [s.id, s]))
  for (const locale of EXTRA_LOCALES) {
    const entry = translations?.[locale as 'uz' | 'en']
    if (!entry) continue
    const title = (entry.title ?? '').trim()
    const lead = (entry.lead ?? '').trim()
    if (title) rows.push({ newsId, locale, field: 'title', value: title })
    if (lead) rows.push({ newsId, locale, field: 'lead', value: lead })
    const sectionMap: Record<string, { html: string } | { values: Record<string, string> }> = {}
    for (const [id, html] of Object.entries(entry.sections ?? {})) {
      const clean = sanitizeRichText(html)
      if (sectionIds.has(id) && clean) sectionMap[id] = { html: clean }
    }
    // Секции-блоки: переводятся только ключи с текстом; HTML — через белый список.
    for (const [id, values] of Object.entries(entry.blocks ?? {})) {
      const section = blockSections.get(id)
      if (!section) continue
      const clean: Record<string, string> = {}
      for (const [key, text] of Object.entries(values)) {
        const base = section.values?.[key]
        if (!base || base.kind === 'image') continue
        const value = base.kind === 'richtext' ? sanitizeRichText(text) : text.trim()
        if (value) clean[key] = value
      }
      if (Object.keys(clean).length > 0) sectionMap[id] = { values: clean }
    }
    if (Object.keys(sectionMap).length > 0) {
      rows.push({ newsId, locale, field: 'sections', value: JSON.stringify(sectionMap) })
    }
  }
  return rows
}

type AdminTranslation = { title: string; lead: string; sections: Record<string, string>; blocks: Record<string, Record<string, string>> }

/** Переводы из базы → форма админки ({ uz: { title, lead, sections, blocks } }). */
export function translationsForAdmin(rows: readonly TrRow[]): Record<string, AdminTranslation> {
  const out: Record<string, AdminTranslation> = {}
  for (const locale of EXTRA_LOCALES) {
    const own = rows.filter((r) => r.locale === locale)
    // Битый json — как будто перевода секций нет (parseSectionTranslations).
    const { sections, blocks } = parseSectionTranslations(own.find((r) => r.field === 'sections')?.value)
    out[locale] = {
      title: own.find((r) => r.field === 'title')?.value ?? '',
      lead: own.find((r) => r.field === 'lead')?.value ?? '',
      sections,
      blocks,
    }
  }
  return out
}

export interface LocaleState {
  /** Язык отмечен к публикации. */
  enabled: boolean
  /** Чего не хватает в переводе (`title`, `lead`, `section:N`). */
  missing: string[]
}

/** Состояние языков для админки: отметка и чего не хватает. */
export function localeStates(news: NewsRow, translations: readonly TrRow[]): Record<string, LocaleState> {
  const out: Record<string, LocaleState> = {}
  for (const locale of EXTRA_LOCALES) {
    out[locale] = { enabled: news.publishOn.includes(locale), missing: missingTranslation(news, translations, locale) }
  }
  return out
}

/**
 * Языки, которые этот запрос впервые отмечает, но перевод для них неполный:
 * { uz: ['title', 'section:3'] }. Пусто — можно сохранять.
 */
export function blockedNewLocales(
  before: readonly string[],
  after: NewsRow,
  translations: readonly TrRow[]
): Partial<Record<Locale, string[]>> {
  const blocked: Partial<Record<Locale, string[]>> = {}
  for (const locale of EXTRA_LOCALES) {
    if (!after.publishOn.includes(locale) || before.includes(locale)) continue
    const missing = missingTranslation(after, translations, locale)
    if (missing.length > 0) blocked[locale] = missing
  }
  return blocked
}
