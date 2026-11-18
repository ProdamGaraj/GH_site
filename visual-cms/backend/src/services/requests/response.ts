/**
 * Ответ странице: только поля, явно разрешённые в привязке
 * (docs/request-pipeline-architecture.md, 3.4). По умолчанию — ничего.
 */
import { DEFAULT_MAX_ITEMS, type ResponseSpec } from './spec'

function getPath(root: unknown, path: string | undefined): unknown {
  if (!path) return root
  let current = root
  for (const segment of path.split('.')) {
    if (current === null || current === undefined) return undefined
    if (Array.isArray(current) && /^\d+$/.test(segment)) current = current[Number(segment)]
    else if (typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, segment)) {
      current = (current as Record<string, unknown>)[segment]
    } else return undefined
  }
  return current
}

function pick(item: unknown, fields: NonNullable<ResponseSpec['fields']>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const field of fields) {
    const value = getPath(item, field.from)
    out[field.to] = value === undefined ? null : value
  }
  return out
}

/** Разрешённая часть ответа; undefined — странице ничего не отдаём. */
export function shapeResponse(data: unknown, spec: ResponseSpec | undefined): unknown {
  if (!spec || spec.expose !== 'fields' || !spec.fields?.length) return undefined
  const base = getPath(data, spec.dataPath)
  if (Array.isArray(base)) return base.slice(0, spec.maxItems ?? DEFAULT_MAX_ITEMS).map((item) => pick(item, spec.fields!))
  if (base === undefined || base === null) return null
  return pick(base, spec.fields)
}
