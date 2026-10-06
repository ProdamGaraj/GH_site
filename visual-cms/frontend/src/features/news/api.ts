import { api } from '@/shared/api'
import { apiFetch, readJson } from '@/shared/api/http'
import type { ProvisionBody, ProvisionResult } from '@/shared/components/ProvisionCollectionModal'
import type { DictionaryEntry, DictionaryKind, NewsDetail, NewsDraft, NewsListItem } from './types'

/**
 * Клиент news-service через прокси /news-api (vite dev / nginx prod).
 * Токен записи X-News-Token добавляет прокси, не браузер; на проде прокси
 * пускает только залогиненных в CMS.
 */
const BASE = '/news-api/api/admin'

function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  return apiFetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => readJson<T>(r))
}

export const newsApi = {
  list: () => send<{ items: NewsListItem[] }>('/news', 'GET').then((r) => r.items),
  get: (id: string) => send<NewsDetail>(`/news/${id}`, 'GET'),
  create: (body: { title: string } & Partial<NewsDraft>) => send<NewsDetail>('/news', 'POST', body),
  /** Частичное обновление; 400 с `details.missing`, если отмечен язык без полного перевода. */
  update: (id: string, body: Partial<NewsDraft>) => send<NewsDetail>(`/news/${id}`, 'PUT', body),
  remove: (id: string) => apiFetch(`${BASE}/news/${id}`, { method: 'DELETE' }).then((r) => (r.ok ? undefined : readJson<void>(r))),
  publish: (id: string) => send<NewsDetail>(`/news/${id}/publish`, 'POST'),
  unpublish: (id: string) => send<NewsDetail>(`/news/${id}/unpublish`, 'POST'),
  archive: (id: string) => send<NewsDetail>(`/news/${id}/archive`, 'POST'),

  listDictionary: (kind: DictionaryKind) => send<{ items: DictionaryEntry[] }>(`/${kind}`, 'GET').then((r) => r.items),
  createDictionary: (kind: DictionaryKind, entry: DictionaryEntry) => send<DictionaryEntry>(`/${kind}`, 'POST', entry),
  /** Ключ не меняется — в теле только правимые поля. */
  updateDictionary: (kind: DictionaryKind, key: string, entry: Omit<DictionaryEntry, 'key'>) =>
    send<DictionaryEntry>(`/${kind}/${encodeURIComponent(key)}`, 'PUT', entry),
  /** Используемую запись сервер не удалит (409) — её прячут. */
  removeDictionary: (kind: DictionaryKind, key: string) =>
    apiFetch(`${BASE}/${kind}/${encodeURIComponent(key)}`, { method: 'DELETE' }).then((r) => (r.ok ? undefined : readJson<void>(r))),
}

/**
 * Коллекция страниц новостей. Это эндпоинт CMS (не news-service), поэтому
 * через общий api-клиент (/api). После деплоя коллекция сообщает сервису, что
 * выкачено, — публичная лента отдаёт только это.
 */
export const newsCmsApi = {
  provisionCollection: (body: ProvisionBody) => api.post<ProvisionResult>('/collections/provision-news', body),
}
