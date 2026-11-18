/**
 * Контекст подстановки шаблона: что знает запрос (docs/request-pipeline-architecture.md, 3.2).
 *
 * form / page / visitor — прислал браузер (данные посетителя, длины ограничены
 * схемой); request / now — знает только сервер.
 */
import type { TemplateContext } from './template'

export interface VisitorInput {
  data: Record<string, unknown>
  page?: { path?: string; lang?: string; title?: string }
  visitor?: {
    referrer?: string
    utm?: { source?: string; medium?: string; campaign?: string; content?: string; term?: string }
  }
}

export interface ServerMeta {
  ip: string
  domain: string
  userAgent: string
}

export function buildRequestContext(input: VisitorInput, meta: ServerMeta, now: Date): TemplateContext {
  return {
    form: { ...input.data },
    page: { path: input.page?.path ?? '', lang: input.page?.lang ?? '', title: input.page?.title ?? '' },
    visitor: { referrer: input.visitor?.referrer ?? '', utm: { ...(input.visitor?.utm ?? {}) } },
    request: { ip: meta.ip, domain: meta.domain, userAgent: meta.userAgent },
    now,
  }
}
