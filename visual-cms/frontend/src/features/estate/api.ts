import { apiFetch, readJson } from '@/shared/api/http'
import { api } from '@/shared/api'
import type { ProvisionResult } from '@/shared/components/ProvisionCollectionModal'
import type {
  ComplexDetail,
  ComplexListItem,
  MapIconOption,
  PlaceType,
  PlanGroupingConfig,
  PlanGroupingPreview,
} from './types'

/**
 * Клиент estate-service через прокси /estate-api (vite dev / nginx prod).
 * Токен записи X-Estate-Token добавляет прокси, не браузер.
 */
const BASE = '/estate-api/api/admin'

const json = readJson

export const estateApi = {
  // --- Карта проекта: типы мест (общие для всех ЖК) и набор иконок ---
  listPlaceTypes: () => apiFetch(`${BASE}/place-types`).then((r) => json<PlaceType[]>(r)),

  createPlaceType: (body: PlaceType) =>
    apiFetch(`${BASE}/place-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => json<PlaceType>(r)),

  /** Ключ не меняется — в теле только правимые поля. */
  updatePlaceType: (key: string, body: Omit<PlaceType, 'key'>) =>
    apiFetch(`${BASE}/place-types/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => json<PlaceType>(r)),

  /** Тип, которым пользуются места, сервер не удалит: 409 со списком ЖК в details.complexes. */
  deletePlaceType: (key: string) =>
    apiFetch(`${BASE}/place-types/${encodeURIComponent(key)}`, { method: 'DELETE' }).then((r) =>
      json<{ ok: boolean }>(r)
    ),

  listMapIcons: () => apiFetch(`${BASE}/map-icons`).then((r) => json<MapIconOption[]>(r)),

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

  /** Во что превратится каталог планировок при черновике настройки. Ничего не сохраняет. */
  previewPlanGroups: (id: string, planGrouping: PlanGroupingConfig | null, signal?: AbortSignal) =>
    apiFetch(`${BASE}/complexes/${id}/plan-groups/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planGrouping }),
      signal,
    }).then((r) => json<PlanGroupingPreview>(r)),

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

}

export type { ProvisionResult } from '@/shared/components/ProvisionCollectionModal'

/**
 * Провижн связки estate → Collection. Это CMS-эндпоинт (не estate-service),
 * поэтому идёт через общий api-клиент (/api), а не через прокси /estate-api.
 */
export const estateCmsApi = {
  provisionCollection: (body: { siteId: string; templatePageId: string; basePath?: string }) =>
    api.post<ProvisionResult>('/collections/provision-estate', body),
}
