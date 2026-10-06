/**
 * Подготовка страниц новостей (чистые функции; запись — setup-news-pages.ts):
 *  - данные страницы /news при публикации: `news` — первые карточки ленты;
 *  - переводы шаблона «Новость»: своя ссылка «← Все новости» и переводы шапки
 *    и подвала, скопированные со страницы-шаблона проекта. Переводы в CMS
 *    привязаны к странице, а языковые версии коллекции строятся только на
 *    языках, где у шаблона есть переводы.
 */
import type { StructureNode } from './choiceToPlanTypes'
import { NEWS_BACK_LINK_ID, NEWS_BACK_LINK_TEXT } from './newsTemplate'

export const NEWS_FEED_DATA_NAME = 'news'
export const NEWS_FEED_DATASOURCE_NAME = 'News — Лента'
/** Первые карточки — в HTML для поисковиков; остальные подгружает браузер. */
export const NEWS_FEED_STATIC_LIMIT = 12

export function newsFeedSourceUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/api/news?lang={{lang}}&limit=${NEWS_FEED_STATIC_LIMIT}`
}

export interface PublishDataDef {
  name: string
  dataSourceId: string
  arrayPath?: string
}

/** Данные страницы: определение `news` добавляется или обновляется, прочие не трогаются. */
export function upsertPublishData(defs: readonly PublishDataDef[] | null | undefined, def: PublishDataDef): { defs: PublishDataDef[]; changed: boolean } {
  const list = [...(defs ?? [])]
  const i = list.findIndex((d) => d.name === def.name)
  if (i === -1) return { defs: [...list, def], changed: true }
  const same = list[i].dataSourceId === def.dataSourceId && list[i].arrayPath === def.arrayPath
  if (same) return { defs: list, changed: false }
  list[i] = def
  return { defs: list, changed: true }
}

/** id всех узлов дерева (включая варианты под экраны). */
export function nodeIds(root: StructureNode): Set<string> {
  const ids = new Set<string>()
  const visit = (n: StructureNode) => {
    if (n.id) ids.add(n.id)
    for (const c of n.children ?? []) visit(c)
    for (const v of Object.values((n.variations ?? {}) as Record<string, { specificChildren?: StructureNode[] }>)) {
      for (const c of v?.specificChildren ?? []) visit(c)
    }
  }
  visit(root)
  return ids
}

export interface TranslationRow {
  nodeId: string
  locale: string
  field: string
  value: string
  status?: string
}

/** Переводы шапки и подвала со страницы проекта — только для их узлов. */
export function rowsToCopy(rows: readonly TranslationRow[], ids: ReadonlySet<string>): TranslationRow[] {
  return rows.filter((r) => ids.has(r.nodeId)).map((r) => ({ nodeId: r.nodeId, locale: r.locale, field: r.field, value: r.value, status: r.status }))
}

/** Перевод ссылки «← Все новости» на языки, где у шаблона будут переводы. */
export function backLinkRows(locales: readonly string[]): TranslationRow[] {
  return locales
    .filter((l): l is 'uz' | 'en' => l === 'uz' || l === 'en')
    .map((locale) => ({ nodeId: NEWS_BACK_LINK_ID, locale, field: 'content', value: NEWS_BACK_LINK_TEXT[locale] }))
}
