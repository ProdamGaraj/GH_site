/**
 * «Один текст для всех языков» в панели переводов.
 *
 * Поле может быть общим по умолчанию (ссылки, медиа) или переводиться по
 * умолчанию (тексты). Галочка в строке показывает, что действует сейчас, а
 * клик пишет на сервер ровно то, что нужно, чтобы стало наоборот:
 *  - включить:  'same' (или снять 'translate', если поле общее по умолчанию);
 *  - выключить: 'translate' у поля, общего по умолчанию, иначе снять отметку.
 * Снятие — 'default': лишних отметок в базе не копится.
 */
export type SameMode = 'same' | 'translate' | 'default'

export function sameMarkMode(checked: boolean, sameByDefault: boolean): SameMode {
  if (checked) return sameByDefault ? 'default' : 'same'
  return sameByDefault ? 'translate' : 'default'
}

/** Ключ поля в карте обзора: тот же, что у правок в панели. */
export const fieldKey = (nodeId: string, field: string): string => `${nodeId}::${field}`
