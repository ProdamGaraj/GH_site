import React from 'react'
import { useAppDispatch } from '@/app/hooks'
import { updateNode } from '@/features/editor/editorSlice'
import type { BlockNode } from '@/shared/types'
import {
  EFFECT_ATTR,
  DURATION_ATTR,
  DEFAULT_EFFECT_ID,
  CAROUSEL_EFFECTS,
  readEffect,
  readDurationMs,
} from '@/features/editor/utils/carouselAutoplayHelper'

/**
 * Секция «Тип перехода» карусели.
 *
 * Пишет data-carousel-effect / data-carousel-duration на корень карусели —
 * их читает CarouselRuntime. Дефолтный эффект и пустую длительность храним
 * отсутствием атрибута: так вёрстка не обрастает значениями, равными дефолту,
 * а смена дефолта в рантайме подхватится сама.
 *
 * Переход виден на опубликованной странице и в превью; холст редактора
 * не листает слайды.
 */
export const CarouselTransitionSection: React.FC<{ carouselRoot: BlockNode }> = ({ carouselRoot }) => {
  const dispatch = useAppDispatch()

  const effect = readEffect(carouselRoot)
  const duration = readDurationMs(carouselRoot)

  const patchAttrs = (next: Record<string, string | undefined>) => {
    const attrs: Record<string, string> = { ...(carouselRoot.attributes || {}) }
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined) delete attrs[k]
      else attrs[k] = v
    }
    dispatch(updateNode({ id: carouselRoot.id, updates: { attributes: attrs } }))
  }

  const setEffect = (id: string) => {
    // Дефолт пишем отсутствием атрибута; заодно сбрасываем длительность,
    // чтобы от прошлого эффекта не осталась чужая скорость.
    patchAttrs({
      [EFFECT_ATTR]: id === DEFAULT_EFFECT_ID ? undefined : id,
      [DURATION_ATTR]: undefined,
    })
  }

  const setDuration = (raw: string) => {
    if (raw === '') {
      patchAttrs({ [DURATION_ATTR]: undefined })
      return
    }
    const ms = parseInt(raw, 10)
    if (!Number.isFinite(ms) || ms < 0) return
    patchAttrs({ [DURATION_ATTR]: String(ms) })
  }

  const instant = effect.id === 'none'

  return (
    <div className="space-y-2 rounded border border-gray-200 p-3">
      <div>
        <h4 className="text-sm font-medium text-gray-900">Тип перехода</h4>
        <p className="text-xs text-gray-500">Как один слайд сменяет другой.</p>
      </div>

      <select
        value={effect.id}
        onChange={(e) => setEffect(e.target.value)}
        className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        {CAROUSEL_EFFECTS.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>

      <p className="text-xs text-gray-400">{effect.hint}</p>

      {!instant && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 shrink-0">Длительность</span>
          <input
            type="number"
            min={0}
            step={50}
            value={duration ?? ''}
            placeholder={String(effect.defaultMs)}
            onChange={(e) => setDuration(e.target.value)}
            className="w-24 px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <span className="text-xs text-gray-500">мс</span>
        </div>
      )}

      {!instant && duration === null && (
        <p className="text-xs text-gray-400">
          Пусто — берётся стандартная для этого перехода: {effect.defaultMs} мс.
        </p>
      )}
    </div>
  )
}
