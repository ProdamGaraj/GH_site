/**
 * Черновик новости в редакторе: чистые функции без React и сети.
 *
 * Полнота перевода считается здесь по тому же правилу, что в news-service
 * (services/news.ts missingTranslation), — чтобы редактор видел, чего не
 * хватает, ещё до сохранения. Решает всё равно сервис: при сохранении он
 * проверит перевод заново и не даст отметить язык с неполным переводом.
 */
import type { ExtraLocale, MediaSide, NewsDetail, NewsDraft, NewsSection, NewsStatus, SectionType } from './types'
import { EXTRA_LOCALES } from './types'

export const STATUS_LABELS: Record<NewsStatus, string> = {
  draft: 'Черновик',
  published: 'Опубликована',
  archived: 'В архиве',
}

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  text: 'Текст',
  photoText: 'Фото + текст',
  sliderText: 'Слайдер + текст',
}

export const SIDE_LABELS: Record<MediaSide, string> = { left: 'Медиа слева', right: 'Медиа справа' }

/** Поля, которые правит редактор, — из ответа сервиса. */
export function draftOf(news: NewsDetail): NewsDraft {
  const translations = {} as NewsDraft['translations']
  for (const locale of EXTRA_LOCALES) {
    const t = news.translations?.[locale]
    translations[locale] = { title: t?.title ?? '', lead: t?.lead ?? '', sections: { ...(t?.sections ?? {}) } }
  }
  return {
    slug: news.slug,
    categoryKey: news.categoryKey,
    tagKeys: [...news.tagKeys],
    title: news.title,
    lead: news.lead,
    cover: news.cover,
    hero: [...news.hero],
    sections: news.sections.map((s) => ({ ...s, media: [...s.media] })),
    publishOn: [...news.publishOn],
    publishedAt: news.publishedAt,
    translations,
  }
}

function newId(): string {
  return globalThis.crypto.randomUUID()
}

/** Новый блок: id сразу — по нему в той же правке можно сохранить перевод. */
export function newSection(type: SectionType): NewsSection {
  return { id: newId(), type, html: '', media: [], side: 'right' }
}

export function updateSection(list: readonly NewsSection[], index: number, patch: Partial<NewsSection>): NewsSection[] {
  return list.map((s, i) => (i === index ? { ...s, ...patch } : s))
}

export function moveSection(list: readonly NewsSection[], index: number, delta: -1 | 1): NewsSection[] {
  const target = index + delta
  if (target < 0 || target >= list.length) return [...list]
  const out = [...list]
  ;[out[index], out[target]] = [out[target], out[index]]
  return out
}

export function removeSection(list: readonly NewsSection[], index: number): NewsSection[] {
  return list.filter((_, i) => i !== index)
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }

/** Видимый текст HTML: пустой абзац редактора `<p></p>` — не текст. */
export function hasText(html: string | null | undefined): boolean {
  const text = (html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_m, name: string) => ENTITIES[name])
    .trim()
  return text.length > 0
}

/** Чего не хватает в переводе: `title`, `lead`, `section:<номер с 1>`. */
export function missingTranslation(draft: NewsDraft, locale: ExtraLocale): string[] {
  const t = draft.translations[locale]
  const missing: string[] = []
  if (draft.title.trim() && !t.title.trim()) missing.push('title')
  if (draft.lead.trim() && !t.lead.trim()) missing.push('lead')
  draft.sections.forEach((section, i) => {
    if (hasText(section.html) && !hasText(t.sections[section.id])) missing.push(`section:${i + 1}`)
  })
  return missing
}

/** `section:3` → «блок 3» — для подсказок у отметки языка. */
export function missingLabel(key: string): string {
  if (key === 'title') return 'заголовок'
  if (key === 'lead') return 'анонс'
  const m = /^section:(\d+)$/.exec(key)
  return m ? `блок ${m[1]}` : key
}

/** Перечень недостающего человеческим языком: «заголовок, блок 2». */
export function missingText(keys: readonly string[]): string {
  return keys.map(missingLabel).join(', ')
}

/**
 * Из ответа сервиса на неудачное сохранение: { missing: { uz: [...] } } →
 * «UZ: заголовок, блок 2». null — ошибка не про перевод.
 */
export function describeBlockedLocales(details: unknown): string | null {
  const missing = (details as { missing?: Partial<Record<ExtraLocale, string[]>> } | undefined)?.missing
  if (!missing || typeof missing !== 'object') return null
  const parts = Object.entries(missing)
    .filter(([, keys]) => Array.isArray(keys) && keys.length > 0)
    .map(([locale, keys]) => `${locale.toUpperCase()}: ${missingText(keys as string[])}`)
  return parts.length ? parts.join('; ') : null
}

/** ISO-дата → значение поля `datetime-local` (местное время браузера). */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Значение поля `datetime-local` → ISO; пусто или мусор — null. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Есть несохранённые правки. */
export function isDirty(draft: NewsDraft, news: NewsDetail): boolean {
  return JSON.stringify(draft) !== JSON.stringify(draftOf(news))
}
