import type { PagePublishDataDef } from '@/shared/api'

/** Имя данных — то, что пишется в разметке как item.<имя>. */
const NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/

/**
 * Ошибки строк «Данных при публикации» — те же правила, что у сервера
 * (updateDataSettingsSchema.publishData), чтобы не отправлять заведомо
 * отклоняемое. Ключ — индекс строки; строки без ошибок в объект не попадают.
 */
export function publishDataErrors(defs: PagePublishDataDef[]): Record<number, string> {
  const errors: Record<number, string> = {}
  const seen = new Set<string>()
  defs.forEach((def, i) => {
    const name = def.name.trim()
    if (!name) errors[i] = 'Укажите имя'
    else if (!NAME_RE.test(name)) errors[i] = 'Имя — латиница, цифры и _, с буквы'
    else if (seen.has(name)) errors[i] = 'Имя уже занято'
    else if (!def.dataSourceId) errors[i] = 'Выберите источник'
    seen.add(name)
  })
  return errors
}

/** То, что уходит на сервер: без пробелов по краям и без пустого пути. */
export function cleanPublishData(defs: PagePublishDataDef[]): PagePublishDataDef[] {
  return defs.map((def) => {
    const arrayPath = def.arrayPath?.trim()
    return { name: def.name.trim(), dataSourceId: def.dataSourceId, ...(arrayPath ? { arrayPath } : {}) }
  })
}
