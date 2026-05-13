/**
 * RepeatSourcePicker — выбор источника данных для repeat-режима карусели.
 *
 * Источник = page.variables[type='array']. Имя выбранной переменной пишется
 * в атрибут data-carousel-variable на carousel-root через editorSlice.updateNode.
 *
 * Состояния:
 *   - 'unset'      — атрибут не задан → подсказка + dropdown
 *   - 'orphan'     — атрибут указывает на отсутствующую переменную → warning
 *   - 'wrong-type' — переменная не array → warning
 *   - 'ok'         — нормальный режим
 *
 * Создание новой переменной идёт через pageDataSettingsApi.updateVariables
 * (после чего envelope перечитывается caller'ом через onCreated callback).
 */
import React, { useState } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { updateNode } from '@/features/editor/editorSlice'
import { Plus, AlertTriangle, Database } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { generateId } from '@/shared/utils'
import type { BlockNode } from '@/shared/types'
import type { PageVariablesEnvelope } from '@/shared/api'
import { pageApi } from '@/shared/api'
import {
  getCarouselSourceStatus,
  getCarouselVariableName,
  listArrayVariables,
  makeNewArrayVariable,
  setCarouselVariableAttr,
} from '@/features/editor/utils/repeatSourceHelper'

interface RepeatSourcePickerProps {
  /** Carousel-root узел (тот, что с data-carousel="true"). */
  carouselRoot: BlockNode
  /** Текущий envelope page-variables. null если ещё грузится. */
  envelope: PageVariablesEnvelope | null
  /** ID страницы — нужен для save новой переменной. */
  pageId: string
  /** Caller перечитает envelope (и slides) после изменений. */
  onEnvelopeChanged: (next: PageVariablesEnvelope) => void
}

export const RepeatSourcePicker: React.FC<RepeatSourcePickerProps> = ({
  carouselRoot,
  envelope,
  pageId,
  onEnvelopeChanged,
}) => {
  const dispatch = useAppDispatch()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentName = getCarouselVariableName(carouselRoot)
  const status = getCarouselSourceStatus(carouselRoot, envelope)
  const candidates = listArrayVariables(envelope)

  const applyName = (name: string | null) => {
    const nextAttrs = setCarouselVariableAttr(carouselRoot.attributes, name)
    dispatch(updateNode({ id: carouselRoot.id, updates: { attributes: nextAttrs } }))
  }

  const handleCreateNew = async () => {
    const proposed = window.prompt('Имя новой переменной (англ., без пробелов):', 'newCarouselSource')
    if (proposed === null) return
    const trimmed = proposed.trim()
    if (trimmed.length === 0) {
      setError('Имя не может быть пустым')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const newVar = makeNewArrayVariable(envelope, trimmed, generateId)
      const nextEnvelope: PageVariablesEnvelope = {
        variables: [...(envelope?.variables || []), newVar],
      }
      // Сохраняем на бэкенде, потом обновляем атрибут — так консистентно.
      // Бэкенд PUT /pages/:id/variables ждёт envelope { variables: { variables: [...] } },
      // pageApi.updateVariables оборачивает корректно.
      const resp = await pageApi.updateVariables(pageId, nextEnvelope)
      onEnvelopeChanged(resp.variables)
      applyName(newVar.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать переменную')
    } finally {
      setCreating(false)
    }
  }

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value
    setError(null)
    applyName(v.length === 0 ? null : v)
  }

  return (
    <div className="rounded border border-gray-200 bg-white p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Database size={16} className="text-gray-500 flex-shrink-0" />
        <div className="text-xs uppercase tracking-wide text-gray-500">Источник данных</div>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={currentName || ''}
          onChange={handleSelectChange}
          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">— не задан —</option>
          {candidates.map(v => (
            <option key={v.id} value={v.name}>
              {v.name}
            </option>
          ))}
          {/* Если currentName указан, но переменной с таким именем нет — добавим
              отдельной opt'ой чтобы select не «прыгал» на пустое. Помечаем (orphan). */}
          {currentName && !candidates.some(v => v.name === currentName) && (
            <option value={currentName}>{currentName} (отсутствует)</option>
          )}
        </select>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCreateNew}
          disabled={creating}
          title="Создать новую array-переменную и привязать"
        >
          <Plus size={14} className="mr-1" />
          {creating ? '…' : 'Новая'}
        </Button>
      </div>

      {status === 'unset' && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          Источник не выбран. Выберите array-переменную или создайте новую.
        </div>
      )}
      {status === 'orphan' && (
        <div className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          <span>
            Переменная <code className="bg-white/60 px-1 rounded">{currentName}</code> не найдена в
            page-variables. Выберите существующую или создайте новую.
          </span>
        </div>
      )}
      {status === 'wrong-type' && (
        <div className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          <span>
            Переменная <code className="bg-white/60 px-1 rounded">{currentName}</code> существует,
            но её тип не <code className="bg-white/60 px-1 rounded">array</code>. Repeat-карусель
            работает только с массивами.
          </span>
        </div>
      )}
      {status === 'ok' && candidates.length === 0 && (
        // Защитный fallback — в теории недостижимо, но на случай гонки
        <div className="text-xs text-gray-500">Переменных пока нет. Создайте через «Новая».</div>
      )}

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {error}
        </div>
      )}
    </div>
  )
}
