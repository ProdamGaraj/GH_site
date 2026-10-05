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
import { sanitizeRichText } from './html'
import { EXTRA_LOCALES, Locale, NewsRow, NewsSection, TrRow, missingTranslation } from './news'
import type { TranslationsInput } from '../schemas/news.schema'

type SectionInput = Omit<NewsSection, 'html'> & { html?: string }

export function normalizeSections(input: readonly SectionInput[]): NewsSection[] {
  const seen = new Set<string>()
  const out: NewsSection[] = []
  for (const section of input) {
    // Повтор id сломал бы привязку перевода — второй блок с тем же id отбрасываем.
    if (seen.has(section.id)) continue
    seen.add(section.id)
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
  const sectionIds = new Set(sections.map((s) => s.id))
  for (const locale of EXTRA_LOCALES) {
    const entry = translations?.[locale as 'uz' | 'en']
    if (!entry) continue
    const title = (entry.title ?? '').trim()
    const lead = (entry.lead ?? '').trim()
    if (title) rows.push({ newsId, locale, field: 'title', value: title })
    if (lead) rows.push({ newsId, locale, field: 'lead', value: lead })
    const sectionMap: Record<string, { html: string }> = {}
    for (const [id, html] of Object.entries(entry.sections ?? {})) {
      const clean = sanitizeRichText(html)
      if (sectionIds.has(id) && clean) sectionMap[id] = { html: clean }
    }
    if (Object.keys(sectionMap).length > 0) {
      rows.push({ newsId, locale, field: 'sections', value: JSON.stringify(sectionMap) })
    }
  }
  return rows
}

/** Переводы из базы → форма админки ({ uz: { title, lead, sections } }). */
export function translationsForAdmin(rows: readonly TrRow[]): Record<string, { title: string; lead: string; sections: Record<string, string> }> {
  const out: Record<string, { title: string; lead: string; sections: Record<string, string> }> = {}
  for (const locale of EXTRA_LOCALES) {
    const own = rows.filter((r) => r.locale === locale)
    const sections: Record<string, string> = {}
    const raw = own.find((r) => r.field === 'sections')?.value
    if (raw) {
      try {
        for (const [id, entry] of Object.entries(JSON.parse(raw) as Record<string, { html?: unknown }>)) {
          if (typeof entry?.html === 'string') sections[id] = entry.html
        }
      } catch {
        // Битый json — как будто перевода секций нет.
      }
    }
    out[locale] = {
      title: own.find((r) => r.field === 'title')?.value ?? '',
      lead: own.find((r) => r.field === 'lead')?.value ?? '',
      sections,
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
