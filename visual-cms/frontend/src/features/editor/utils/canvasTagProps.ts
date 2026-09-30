import type React from 'react'
import type { BlockNode } from '@/shared/types'

/**
 * Атрибуты элемента канваса, зависящие от тега: поля, картинки, видео, формы.
 *
 * Канвас переносит с узла не все атрибуты (только class и эти), поэтому
 * здесь важно не выдумывать своих: стили сайта завязаны на атрибуты
 * (`input[type="text"]`, `button[type="submit"]` в базовых стилях форм), и
 * атрибут, которого нет на опубликованной странице, давал в канвасе чужой вид.
 */
export function canvasTagProps(node: Pick<BlockNode, 'tagName' | 'attributes' | 'content'>): Record<string, unknown> {
  const attrs = node.attributes ?? {}
  const content = typeof node.content === 'string' ? node.content : ''
  switch (node.tagName) {
    case 'input':
      // Нет type — не ставим: браузер и так покажет текстовое поле, а
      // input[type="text"] на сайте такое поле не ловит.
      return {
        ...(attrs.type ? { type: attrs.type } : {}),
        placeholder: attrs.placeholder || '',
        value: content,
        readOnly: true,
      }
    case 'textarea':
      return { placeholder: attrs.placeholder || '', value: content, readOnly: true }
    case 'button':
      // type — как на сайте; кнопка внутри формы по умолчанию её отправляет,
      // поэтому форма в канвасе не отправляется (см. form).
      return attrs.type ? { type: attrs.type } : {}
    case 'form':
      // Иначе клик по кнопке формы перезагружал бы редактор.
      return { onSubmit: (e: React.FormEvent) => e.preventDefault() }
    case 'img':
      return { src: attrs.src || 'https://via.placeholder.com/150', alt: attrs.alt || '' }
    case 'video':
      // Без проброса атрибутов <video> на канвасе был пустым боксом.
      // Автоплей в редакторе не включаем; muted всегда — канвас не должен звучать.
      return {
        ...(attrs.src ? { src: attrs.src } : {}),
        ...(attrs.poster ? { poster: attrs.poster } : {}),
        controls: attrs.controls !== undefined && attrs.controls !== 'false',
        loop: attrs.loop !== undefined && attrs.loop !== 'false',
        muted: true,
        playsInline: true,
        autoPlay: false,
        preload: 'metadata',
      }
    case 'select':
      return { value: attrs.value || '', onChange: () => {} } // только чтение
    case 'option':
      return { value: attrs.value || content }
    default:
      return {}
  }
}
