import React, { useMemo } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { updateNode } from '@/features/editor/editorSlice'
import type { BlockNode } from '@/shared/types'
import {
  CAROUSEL_CONTROL_ROLES,
  flattenForPicker,
  findControlHolderId,
  assignControlRole,
} from '@/features/editor/utils/carouselHelpers'

/**
 * Пикер управляющих элементов карусели: на каждую роль (стрелки/точки/счётчик)
 * можно назначить ЛЮБОЙ элемент из дерева карусели, а не только авто-добавленные.
 * Назначение проставляет соответствующий data-carousel-* на выбранный узел и
 * снимает его с прежнего держателя (через dispatch updateNode).
 */
export const CarouselControlsPicker: React.FC<{ carouselRoot: BlockNode }> = ({ carouselRoot }) => {
  const dispatch = useAppDispatch()
  const options = useMemo(() => flattenForPicker(carouselRoot), [carouselRoot])

  const apply = (attr: string, targetId: string) => {
    const changes = assignControlRole(carouselRoot, attr, targetId)
    for (const c of changes) {
      dispatch(updateNode({ id: c.id, updates: { attributes: c.attributes } }))
    }
  }

  return (
    <div className="space-y-2 rounded border border-gray-200 p-3">
      <div>
        <h4 className="text-sm font-medium text-gray-900">Элементы управления</h4>
        <p className="text-xs text-gray-500">
          Назначь любой элемент дерева на роль — не только кнопки по умолчанию.
        </p>
      </div>

      {CAROUSEL_CONTROL_ROLES.map((role) => {
        const current = findControlHolderId(carouselRoot, role.attr)
        return (
          <div key={role.key} className="flex items-center gap-2">
            <span className="text-xs text-gray-600 w-2/5 shrink-0">{role.label}</span>
            <select
              value={current}
              onChange={(e) => apply(role.attr, e.target.value)}
              className="flex-1 min-w-0 px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">— не задано —</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )
      })}
    </div>
  )
}
