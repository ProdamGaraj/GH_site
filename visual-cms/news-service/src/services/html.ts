import sanitizeHtml from 'sanitize-html'

/**
 * Форматированный текст секций новости.
 *
 * HTML из визуального редактора (TipTap) и из импорта Telegram вставляется на
 * страницу как есть (html-code узел шаблона), поэтому сервис чистит его при
 * КАЖДОЙ записи — это граница безопасности, браузеру и CMS он доверяет.
 * Белый список: абзацы, переносы, жирный, курсив, подчёркнутый,
 * зачёркнутый, ссылки, списки, подзаголовки h2/h3, цитаты. Всё остальное
 * (script, style, iframe, атрибуты событий и style) вырезается.
 *
 * Ссылки: только http(s), mailto, tel и относительные. Внешние открываются в
 * новой вкладке с rel="noopener noreferrer". `<b>`/`<i>` приводятся к
 * `<strong>`/`<em>` — разметка одинаковая, откуда бы текст ни пришёл.
 *
 * Чистка идемпотентна: повторный проход ничего не меняет.
 *
 * sanitize-html закреплён точно на 2.17.5: с 2.17.6 он тянет htmlparser2 v12,
 * который только ESM — `require` в Node 20 (образ сервиса) и в jest падает.
 */
export const RICH_TEXT_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote']

const EXTERNAL_LINK = /^https?:\/\//i

export function sanitizeRichText(input: string | null | undefined): string {
  const clean = sanitizeHtml(input ?? '', {
    allowedTags: RICH_TEXT_TAGS,
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesAppliedToAttributes: ['href'],
    allowProtocolRelative: false,
    transformTags: {
      b: 'strong',
      i: 'em',
      a: (_tag, attribs): sanitizeHtml.Tag => {
        const href = (attribs.href ?? '').trim()
        const out: sanitizeHtml.Attributes = {}
        if (href) out.href = href
        if (EXTERNAL_LINK.test(href)) Object.assign(out, { target: '_blank', rel: 'noopener noreferrer' })
        return { tagName: 'a', attribs: out }
      },
    },
  })
  return clean.trim()
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' }

/** Текст без разметки: для поиска, полноты перевода и анонсов. */
export function plainText(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<(br|\/p|\/li|\/h[23]|\/blockquote)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_m, name: string) => ENTITIES[name])
    .replace(/\s+/g, ' ')
    .trim()
}

/** В HTML есть видимый текст (пустой абзац `<p></p>` из редактора — не текст). */
export function hasText(html: string | null | undefined): boolean {
  return plainText(html).length > 0
}
