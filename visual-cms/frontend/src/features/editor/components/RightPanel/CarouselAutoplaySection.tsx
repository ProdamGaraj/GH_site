import React from 'react'
import { useAppDispatch } from '@/app/hooks'
import { updateNode } from '@/features/editor/editorSlice'
import type { BlockNode } from '@/shared/types'
import {
  AUTOPLAY_ATTR,
  LOOP_ATTR,
  DEFAULT_DELAY_MS,
  MIN_SECONDS,
  readAutoplayMs,
} from '@/features/editor/utils/carouselAutoplayHelper'

/**
 * Секция «Автопрокрутка» карусели.
 *
 * Управляет атрибутами корня карусели (data-carousel-autoplay / data-carousel-loop),
 * которые читает рантайм CarouselRuntime. В UI задержку показываем в секундах
 * (дружелюбнее), храним в мс. Действует на опубликованной странице/в превью —
 * холст редактора не автолистает.
 */
export const CarouselAutoplaySection: React.FC<{ carouselRoot: BlockNode }> = ({ carouselRoot }) => {
  const dispatch = useAppDispatch()

  const ms = readAutoplayMs(carouselRoot)
  const enabled = ms > 0
  const seconds = enabled ? ms / 1000 : DEFAULT_DELAY_MS / 1000
  // Рантайм считает loop=true при отсутствии атрибута; off только при явном 'false'.
  const loop = carouselRoot.attributes?.[LOOP_ATTR] !== 'false'

  const patchAttrs = (next: Record<string, string | undefined>) => {
    const attrs: Record<string, string> = { ...(carouselRoot.attributes || {}) }
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined) delete attrs[k]
      else attrs[k] = v
    }
    dispatch(updateNode({ id: carouselRoot.id, updates: { attributes: attrs } }))
  }

  const toggleEnabled = (on: boolean) => {
    patchAttrs({ [AUTOPLAY_ATTR]: on ? String(DEFAULT_DELAY_MS) : undefined })
  }

  const setSeconds = (val: number) => {
    if (Number.isNaN(val)) return
    const clamped = Math.max(MIN_SECONDS, val)
    patchAttrs({ [AUTOPLAY_ATTR]: String(Math.round(clamped * 1000)) })
  }

  const setLoop = (on: boolean) => {
    // Пишем 'false' только для выключения; включение = убрать атрибут (дефолт рантайма).
    patchAttrs({ [LOOP_ATTR]: on ? undefined : 'false' })
  }

  return (
    <div className="space-y-2 rounded border border-gray-200 p-3">
      <div>
        <h4 className="text-sm font-medium text-gray-900">Автопрокрутка</h4>
        <p className="text-xs text-gray-500">
          Слайды листаются сами через заданный интервал. Работает на опубликованной странице.
        </p>
      </div>

      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={(e) => toggleEnabled(e.target.checked)} />
        <span>Листать автоматически</span>
      </label>

      {enabled && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 shrink-0">Задержка между слайдами</span>
            <input
              type="number"
              min={MIN_SECONDS}
              step={0.5}
              value={seconds}
              onChange={(e) => setSeconds(parseFloat(e.target.value))}
              className="w-20 px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <span className="text-xs text-gray-500">сек</span>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
            <span>Зацикливать (листать по кругу)</span>
          </label>
        </>
      )}
    </div>
  )
}
