import { useCallback, useRef } from 'react'

/**
 * Хук для фона (overlay) модального окна: закрывает модалку только если
 * И mousedown, И mouseup произошли на самом оверлее, а не внутри окна.
 *
 * Чинит ложное закрытие: при выделении текста (или drag) внутри модалки, когда
 * курсор отпускают за её границей, нативный `click` срабатывает на общем предке —
 * оверлее — и модалка закрывалась. Здесь закрытие триггерит только «чистый» клик
 * по фону (down и up оба на оверлее).
 *
 * Использование:
 *   const overlay = useOverlayClose(() => setOpen(false))
 *   <div className="fixed inset-0 ..." {...overlay}>
 *     <div onClick={(e) => e.stopPropagation()}>...</div>
 *   </div>
 */
export function useOverlayClose(onClose: () => void) {
  const downOnOverlay = useRef(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // true только если нажатие пришлось на сам оверлей, а не на его потомков (окно)
    downOnOverlay.current = e.target === e.currentTarget
  }, [])

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (downOnOverlay.current && e.target === e.currentTarget) {
        onClose()
      }
      downOnOverlay.current = false
    },
    [onClose],
  )

  return { onMouseDown, onMouseUp }
}
