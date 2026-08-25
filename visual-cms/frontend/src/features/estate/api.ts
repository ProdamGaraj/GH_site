import { apiFetch, ApiError } from '@/shared/api/http'
import { api } from '@/shared/api'
import type { ComplexDetail, ComplexListItem } from './types'

/**
 * Клиент estate-service через прокси /estate-api (vite dev / nginx prod).
 * Токен записи X-Estate-Token добавляет прокси, не браузер.
 */
const BASE = '/estate-api/api/admin'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let details: unknown
    try {
      details = await res.json()
    } catch {
      /* ignore */
    }
    const msg = (details as any)?.error || `HTTP ${res.status}`
    throw new ApiError(msg, res.status, { details })
  }
  return res.json() as Promise<T>
}

export const estateApi = {
  listComplexes: () => apiFetch(`${BASE}/complexes`).then((r) => json<ComplexListItem[]>(r)),

  getComplex: (id: string) => apiFetch(`${BASE}/complexes/${id}`).then((r) => json<ComplexDetail>(r)),

  createComplex: (body: Record<string, unknown>) =>
    apiFetch(`${BASE}/complexes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => json<{ id: string; slug: string }>(r)),

  updateComplex: (id: string, body: Record<string, unknown>) =>
    apiFetch(`${BASE}/complexes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => json<{ ok: boolean }>(r)),

  deleteComplex: (id: string) =>
    apiFetch(`${BASE}/complexes/${id}`, { method: 'DELETE' }).then((r) => json<{ ok: boolean }>(r)),

  createHouse: (complexId: string, body: Record<string, unknown>) =>
    apiFetch(`${BASE}/complexes/${complexId}/houses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => json<{ id: string }>(r)),

  updateHouse: (id: string, body: Record<string, unknown>) =>
    apiFetch(`${BASE}/houses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => json<{ ok: boolean }>(r)),

  deleteHouse: (id: string) =>
    apiFetch(`${BASE}/houses/${id}`, { method: 'DELETE' }).then((r) => json<{ ok: boolean }>(r)),

  createApartment: (houseId: string, body: Record<string, unknown>) =>
    apiFetch(`${BASE}/houses/${houseId}/apartments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => json<{ id: string }>(r)),

  updateApartment: (id: string, body: Record<string, unknown>) =>
    apiFetch(`${BASE}/apartments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => json<{ ok: boolean }>(r)),

  deleteApartment: (id: string) =>
    apiFetch(`${BASE}/apartments/${id}`, { method: 'DELETE' }).then((r) => json<{ ok: boolean }>(r)),
}

export interface ProvisionResult {
  dataSourceId: string
  collectionId: string
  created: { dataSource: boolean; collection: boolean }
}

/**
 * Провижн связки estate → Collection. Это CMS-эндпоинт (не estate-service),
 * поэтому идёт через общий api-клиент (/api), а не через прокси /estate-api.
 */
export const estateCmsApi = {
  provisionCollection: (body: { siteId: string; templatePageId: string; basePath?: string }) =>
    api.post<ProvisionResult>('/collections/provision-estate', body),
}
