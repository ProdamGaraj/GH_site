/**
 * Находится ли фокус в редактируемом поле — чтобы глобальные горячие клавиши
 * редактора (Ctrl+C/V/D, Delete) НЕ срабатывали во время набора текста.
 *
 * Простой проверки `tagName === 'INPUT' | 'TEXTAREA'` недостаточно: Monaco
 * (панель Custom CSS / globalCss) редактирует не в самом `<textarea>`, а в слое
 * `.view-lines` (div/span), и при Ctrl+V `event.target` — этот внутренний узел,
 * а не textarea. Гард промахивался, и вместо вставки текста в поле в структуру
 * страницы вставлялась копия блока.
 *
 * Поэтому дополнительно поднимаемся по дереву: любой предок `.monaco-editor`
 * или `[contenteditable]` (кроме "false") считается редактируемым.
 */
export function isEditableTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false

  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true

  // Внутренние узлы Monaco / contenteditable-редакторов
  return !!el.closest('.monaco-editor, [contenteditable="true"], [contenteditable=""]')
}

/**
 * Редактирование в фокусе с учётом события И document.activeElement.
 * activeElement — страховка: у некоторых редакторов keydown приходит с
 * target=document.body, а реальный фокус висит на внутреннем поле.
 */
export function isTypingContext(e: { target: EventTarget | null }): boolean {
  return (
    isEditableTarget(e.target) ||
    (typeof document !== 'undefined' && isEditableTarget(document.activeElement))
  )
}
