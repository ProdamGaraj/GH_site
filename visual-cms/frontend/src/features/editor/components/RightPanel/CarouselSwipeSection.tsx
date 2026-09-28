import React from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { updateNode, selectBreakpoints } from '@/features/editor/editorSlice'
import type { BlockNode } from '@/shared/types'
import {
  SWIPE_ATTR,
  defaultSwipeScreens,
  readSwipeScreens,
  swipeAttrValue,
} from '@/features/editor/utils/carouselSwipeHelper'

/**
 * Секция «Свайп» карусели.
 *
 * Экраны страницы, где слайды листаются жестом вправо-влево (на компьютере —
 * перетаскиванием мышью). Пишет атрибут корня data-carousel-swipe, который
 * читает рантайм CarouselRuntime. Действует на опубликованной странице и в
 * превью. При одном слайде рантайм жест не перехватывает сам.
 */
export const CarouselSwipeSection: React.FC<{ carouselRoot: BlockNode }> = ({ carouselRoot }) => {
  const dispatch = useAppDispatch()
  const breakpoints = useAppSelector(selectBreakpoints)
  const screens = readSwipeScreens(carouselRoot)
  const enabled = screens.length > 0
  // От узкого экрана к широкому — как телефон, планшет, компьютер.
  const ordered = [...breakpoints].sort((a, b) => a.width - b.width)

  const setScreens = (next: string[]) => {
    const attrs: Record<string, string> = {
      ...(carouselRoot.attributes || {}),
      [SWIPE_ATTR]: swipeAttrValue(next, ordered),
    }
    dispatch(updateNode({ id: carouselRoot.id, updates: { attributes: attrs } }))
  }

  const toggleScreen = (id: string, on: boolean) => {
    setScreens(on ? [...screens, id] : screens.filter((s) => s !== id))
  }

  return (
    <div className="space-y-2 rounded border border-gray-200 p-3">
      <div>
        <h4 className="text-sm font-medium text-gray-900">Свайп</h4>
        <p className="text-xs text-gray-500">
          Слайды листаются жестом вправо-влево, на компьютере — перетаскиванием мышью. Работает на опубликованной
          странице; если слайд один, свайп отключается сам.
        </p>
      </div>

      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setScreens(e.target.checked ? defaultSwipeScreens(ordered) : [])}
        />
        <span>Включить свайпы</span>
      </label>

      {enabled && (
        <div className="space-y-1 pl-5">
          <span className="text-xs text-gray-600">На экранах</span>
          {ordered.map((bp) => (
            <label key={bp.id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={screens.includes(bp.id)}
                onChange={(e) => toggleScreen(bp.id, e.target.checked)}
              />
              <span>
                {bp.name} <span className="text-gray-400">{bp.width}px</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
