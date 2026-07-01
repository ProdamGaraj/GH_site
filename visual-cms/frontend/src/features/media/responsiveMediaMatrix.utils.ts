/**
 * Чистые хелперы матрицы адаптивного медиа (для юнит-тестов).
 */
import type { BlockNode } from '@/shared/types'

export type MediaSlot = 'src' | 'bg'

/** Голый URL из CSS background-image: url("…"). null для градиентов/сложных значений. */
export function parseCssUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  const m =
    v.match(/^url\(\s*"([^"]*)"\s*\)$/i) ||
    v.match(/^url\(\s*'([^']*)'\s*\)$/i) ||
    v.match(/^url\(\s*([^'")]+?)\s*\)$/i)
  return m?.[1]?.trim() || null
}

/**
 * Поле перевода для слота (+ суффикс брейкпоинта):
 *   src → 'src' | 'src@<bp>'; bg → 'bg:image' | 'bg:image@<bp>'.
 */
export function translationField(slot: MediaSlot, bpId: string | null): string {
  const base = slot === 'src' ? 'src' : 'bg:image'
  return bpId ? `${base}@${bpId}` : base
}

/** Экранный оверрайд узла на брейкпоинте: ищем inheritedOverrides по всему дереву. */
export function findOverride(
  root: BlockNode | null,
  nodeId: string,
  bpId: string,
): { attributes?: Record<string, string>; styles?: Record<string, string> } | null {
  if (!root) return null
  let found: { attributes?: Record<string, string>; styles?: Record<string, string> } | null = null
  const walk = (n: BlockNode): void => {
    if (found) return
    const ov = n.variations?.[bpId]?.inheritedOverrides?.[nodeId]
    if (ov) {
      found = ov as { attributes?: Record<string, string>; styles?: Record<string, string> }
      return
    }
    for (const c of n.children || []) walk(c)
    if (n.variations) {
      for (const v of Object.values(n.variations)) {
        for (const sc of v.specificChildren || []) walk(sc)
      }
    }
  }
  walk(root)
  return found
}
