import React, { useMemo } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { updateNode } from '@/features/editor/editorSlice'
import type { BlockNode } from '@/shared/types'
import { getOverlayChildren, findTrackNode } from '@/features/editor/utils/carouselHelpers'

const POSITIONED = new Set(['relative', 'absolute', 'fixed', 'sticky'])

/**
 * Секция «Поверх слайдера»: блоки-соседи трека (карточка, контролы, текст) можно
 * положить поверх слайдов. Тумблер ставит элементу position:absolute; inset:0, а
 * корню карусели — position:relative (якорь). Эти блоки остаются соседями трека,
 * то есть НЕ становятся частью слайда.
 */
export const CarouselOverlaysSection: React.FC<{ carouselRoot: BlockNode }> = ({ carouselRoot }) => {
  const dispatch = useAppDispatch()
  const overlays = useMemo(() => getOverlayChildren(carouselRoot), [carouselRoot])

  if (overlays.length === 0) return null

  const mergeProps = (node: BlockNode, props: Record<string, string | undefined>) => {
    const next: Record<string, string | undefined> = { ...(node.styles?.properties || {}) }
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined) delete next[k]
      else next[k] = v
    }
    dispatch(
      updateNode({
        id: node.id,
        updates: { styles: { ...node.styles, properties: next as BlockNode['styles']['properties'] } },
      })
    )
  }

  const ensureRootAnchor = () => {
    const pos = carouselRoot.styles?.properties?.position
    if (!pos || !POSITIONED.has(pos)) {
      mergeProps(carouselRoot, { position: 'relative' })
    }
  }

  const setOverlay = (child: BlockNode, on: boolean) => {
    if (on) {
      ensureRootAnchor()
      mergeProps(child, { position: 'absolute', inset: '0' })
    } else {
      mergeProps(child, { position: undefined, inset: undefined })
    }
  }

  // «Слайдер фоном»: трек становится абсолютным фоном во весь блок, слайды
  // заполняют его, а оверлеи (контент) ложатся поверх. Так слайдер заполняет
  // геро как на оригинале (а не короткой полосой сверху с белым провалом).
  const track = findTrackNode(carouselRoot)
  const sliderAsBackground = track?.styles?.properties?.position === 'absolute'

  const setSliderBackground = (on: boolean) => {
    ensureRootAnchor()
    if (track) {
      mergeProps(
        track,
        on
          ? { position: 'absolute', inset: '0', zIndex: '0', width: '100%', height: '100%' }
          : { position: undefined, inset: undefined, zIndex: undefined, height: undefined }
      )
      for (const slide of track.children || []) {
        mergeProps(slide, on ? { height: '100%' } : { height: undefined })
      }
    }
    for (const ov of overlays) {
      if (on) mergeProps(ov, { position: ov.styles?.properties?.position || 'relative', zIndex: '1' })
      else mergeProps(ov, { zIndex: undefined })
    }
  }

  return (
    <div className="space-y-2 rounded border border-gray-200 p-3">
      <div>
        <h4 className="text-sm font-medium text-gray-900">Слайдер фоном</h4>
        <p className="text-xs text-gray-500">
          Слайдер заполняет весь блок как фон, а контент ложится поверх. Убирает белый провал
          и «белый текст по белому».
        </p>
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={sliderAsBackground}
          onChange={(e) => setSliderBackground(e.target.checked)}
        />
        <span>Слайдер во весь блок (контент поверх)</span>
      </label>

      <div className="pt-2 border-t border-gray-100">
        <h4 className="text-sm font-medium text-gray-900">Поверх слайдера (поэлементно)</h4>
        <p className="text-xs text-gray-500">
          Точечно положить отдельный блок-сосед трека поверх слайдов (он остаётся не частью слайда).
        </p>
      </div>
      {overlays.map((child) => {
        const pinned = child.styles?.properties?.position === 'absolute'
        return (
          <label key={child.id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setOverlay(child, e.target.checked)}
            />
            <span className="truncate">{child.metadata?.name || child.tagName || 'блок'}</span>
          </label>
        )
      })}
      <p className="text-[11px] text-gray-400">
        По умолчанию блок растягивается на весь слайдер (inset: 0). Точную позицию (низ/угол)
        задаёшь в стилях элемента.
      </p>
    </div>
  )
}
