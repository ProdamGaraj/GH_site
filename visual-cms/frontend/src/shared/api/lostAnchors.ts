/**
 * Предупреждение при сохранении блока: из блока данных пропали якоря, которые
 * заполняют новости (backend BlockController.update → `_lostAnchors`).
 * Сохранение не отменяется — блок может править дизайнер, — но администратор
 * должен узнать, что в этих новостях часть полей больше не выводится.
 */
export interface LostAnchors {
  keys: string[]
  news: Array<{ id: string; title: string }>
}

export function lostAnchorsMessage(lost: LostAnchors | undefined | null): string | null {
  if (!lost || lost.keys.length === 0 || lost.news.length === 0) return null
  const titles = lost.news.slice(0, 5).map((n) => `«${n.title}»`).join(', ')
  const more = lost.news.length > 5 ? ` и ещё ${lost.news.length - 5}` : ''
  return `Блок сохранён, но из него удалены поля данных (${lost.keys.join(', ')}), которые заполняют новости: ${titles}${more}. В этих новостях эти поля больше не выводятся.`
}

/** Показывает предупреждение, если оно есть в ответе сохранения блока; ответ — без изменений. */
export function warnLostAnchors<T>(response: T): T {
  const message = lostAnchorsMessage((response as { _lostAnchors?: LostAnchors } | null)?._lostAnchors)
  if (message && typeof window !== 'undefined') window.alert(message)
  return response
}
