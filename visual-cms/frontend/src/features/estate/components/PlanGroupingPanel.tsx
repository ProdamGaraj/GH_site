import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Merge, RotateCcw, Save, Split, Undo2 } from 'lucide-react'
import { resolveMediaUrl } from '@/shared/api/mediaApi'
import type { PlanGroupingConfig, PlanGroupPreview, PlanGroupingPreview, PlanPreview } from '../types'
import { estateApi } from '../api'
import {
  PlanGroupingDraft,
  dropNames,
  formatAreaRange,
  formatNumberRange,
  mergeCards,
  restorePlan,
  roomsLabel,
  sameConfig,
  separatePlan,
  setTolerance,
  toDraft,
  toPayload,
  ungroupCard,
} from '../planGroupingEdit'

/** Пауза перед пересчётом: не дёргать сервер на каждую цифру допуска. */
const PREVIEW_DEBOUNCE_MS = 300

const cardKey = (group: PlanGroupPreview) => group.plans.map((p) => p.planName).join('\u0000')

/**
 * Раздел «Планировки на сайте»: какие типы планировок покупатель увидит одной
 * карточкой.
 *
 * Группы считает сервер тем же кодом, что и сайт, — здесь только черновик
 * настройки и кнопки, которые его меняют (planGroupingEdit.ts). Сохраняется
 * отдельной кнопкой и только поле planGrouping: форма ЖК его не отправляет.
 */
export const PlanGroupingPanel: React.FC<{
  complexId: string
  initial: PlanGroupingConfig | null | undefined
}> = ({ complexId, initial }) => {
  const [saved, setSaved] = useState<PlanGroupingDraft>(() => toDraft(initial))
  const [draft, setDraft] = useState<PlanGroupingDraft>(() => toDraft(initial))
  const [toleranceText, setToleranceText] = useState(() => String(toDraft(initial).areaTolerance))
  const [preview, setPreview] = useState<PlanGroupingPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const dirty = !sameConfig(saved, draft)

  // Пересчёт при каждой правке черновика. Устаревший ответ отменяется, чтобы
  // медленный запрос не перетёр более свежий.
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(() => {
      estateApi
        .previewPlanGroups(complexId, toPayload(draft), controller.signal)
        .then((result) => {
          setPreview(result)
          setError(null)
        })
        .catch((e: any) => {
          if (!controller.signal.aborted) setError(e?.message || 'Не удалось посчитать карточки')
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, PREVIEW_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [complexId, draft])

  // Состав карточек поменялся — старый выбор больше ничего не значит.
  useEffect(() => setSelected(new Set()), [preview])

  const edit = (next: PlanGroupingDraft) => {
    setDraft(next)
    setMsg(null)
  }

  const changeTolerance = (text: string) => {
    setToleranceText(text)
    edit(setTolerance(draft, text))
  }

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const mergeSelected = () => {
    if (!preview) return
    const cards = preview.groups
      .filter((g) => selected.has(cardKey(g)))
      .map((g) => g.plans.map((p) => p.planName))
    edit(mergeCards(draft, cards))
  }

  const reset = () => {
    setDraft(saved)
    setToleranceText(String(saved.areaTolerance))
    setMsg(null)
  }

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      await estateApi.updateComplex(complexId, { planGrouping: toPayload(draft) })
      setSaved(draft)
      setMsg('Сохранено. На сайте появится после передеплоя коллекции проекта.')
    } catch (e: any) {
      setMsg(e?.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const multipleHouses = useMemo(
    () => new Set(preview?.groups.flatMap((g) => g.plans.map((p) => p.houseId)) ?? []).size > 1,
    [preview]
  )

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Планировки на сайте</h2>
          <p className="text-sm text-gray-500">
            {preview
              ? `${preview.typesCount} типов из CRM → ${preview.cardsCount} карточек`
              : 'Считаю карточки…'}
            {dirty && <span className="ml-2 text-amber-600">есть несохранённые изменения</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={reset}
            disabled={!dirty || saving}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 disabled:opacity-50"
          >
            <RotateCcw size={16} /> Сбросить
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50"
          >
            <Save size={16} /> Сохранить
          </button>
        </div>
      </div>
      {msg && <p className="text-sm text-gray-600">{msg}</p>}

      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Допуск по площади, м²</span>
          <input
            type="text"
            inputMode="decimal"
            value={toleranceText}
            onChange={(e) => changeTolerance(e.target.value)}
            className="w-28 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </label>
        <p className="text-xs text-gray-500 max-w-md pb-2">
          Наибольшая разница площадей внутри одной карточки. 0 — склеиваются только планировки с
          одинаковой площадью. Склейка идёт внутри одного корпуса и одной комнатности.
        </p>
      </div>

      <Warnings
        preview={preview}
        onDropUnknown={(names) => edit(dropNames(draft, names))}
      />

      <div className="sticky top-0 z-10 flex items-center gap-3 py-2 bg-white border-b border-gray-100">
        <span className="text-sm text-gray-600">Выбрано карточек: {selected.size}</span>
        <button
          onClick={mergeSelected}
          disabled={selected.size < 2}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-md text-sm hover:bg-primary-100 disabled:opacity-40"
        >
          <Merge size={16} /> Объединить в одну
        </button>
        {selected.size > 0 && (
          <button onClick={() => setSelected(new Set())} className="text-sm text-gray-500 hover:text-gray-700">
            Снять выбор
          </button>
        )}
        {loading && <span className="ml-auto text-xs text-gray-400">пересчёт…</span>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
        {preview?.groups.map((group) => {
          const key = cardKey(group)
          return (
            <PlanCard
              key={key}
              group={group}
              checked={selected.has(key)}
              showHouse={multipleHouses}
              onToggle={() => toggle(key)}
              onSeparate={(name) => edit(separatePlan(draft, name))}
              onRestore={(name) => edit(restorePlan(draft, name))}
              onUngroup={() => edit(ungroupCard(draft, group.plans.map((p) => p.planName)))}
            />
          )
        })}
        {preview && preview.groups.length === 0 && (
          <p className="text-sm text-gray-400">
            Нет планировок с квартирами в продаже — нечего показывать.
          </p>
        )}
      </div>
    </div>
  )
}

const Warnings: React.FC<{
  preview: PlanGroupingPreview | null
  onDropUnknown: (names: string[]) => void
}> = ({ preview, onDropUnknown }) => {
  if (!preview) return null
  const { duplicateNames, unknownNames } = preview.warnings
  if (duplicateNames.length === 0 && unknownNames.length === 0) return null
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 space-y-2">
      {unknownNames.length > 0 && (
        <div className="flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            В настройке есть планировки, которых нет на сайте (распроданы или переименованы в CRM):{' '}
            <b>{unknownNames.join(', ')}</b>. Правила по ним ничего не делают.
          </div>
          <button onClick={() => onDropUnknown(unknownNames)} className="shrink-0 underline hover:no-underline">
            Убрать из настройки
          </button>
        </div>
      )}
      {duplicateNames.length > 0 && (
        <div className="flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            Одинаковые имена у разных типов: <b>{duplicateNames.join(', ')}</b>. Ручное объединение или
            отделение по такому имени заденет только один из них.
          </div>
        </div>
      )}
    </div>
  )
}

const PlanCard: React.FC<{
  group: PlanGroupPreview
  checked: boolean
  showHouse: boolean
  onToggle: () => void
  onSeparate: (name: string) => void
  onRestore: (name: string) => void
  onUngroup: () => void
}> = ({ group, checked, showHouse, onToggle, onSeparate, onRestore, onUngroup }) => {
  const several = group.plans.length > 1
  return (
    <div
      className={`rounded-lg border p-4 flex gap-3 ${
        checked ? 'border-primary-400 ring-2 ring-primary-100' : 'border-gray-200'
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1 h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-gray-900">
            {roomsLabel(group.rooms, group.isStudio)} {formatAreaRange(group.areaMin, group.areaMax)}
          </span>
          {group.manual && (
            <span className="px-2 py-0.5 rounded bg-primary-50 text-primary-700 text-xs">вручную</span>
          )}
          <span className="text-sm text-gray-500">
            квартир {group.apartmentsCount} · этажи {formatNumberRange(group.floors)} · подъезды{' '}
            {group.entrances.join(', ') || '—'}
          </span>
          {group.manual && (
            <button
              onClick={onUngroup}
              className="ml-auto flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
            >
              <Undo2 size={14} /> Распустить
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {group.plans.map((plan) => (
            <PlanTile
              key={`${plan.houseId}:${plan.planName}`}
              plan={plan}
              showHouse={showHouse}
              onSeparate={several ? () => onSeparate(plan.planName) : undefined}
              onRestore={plan.separated ? () => onRestore(plan.planName) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const PlanTile: React.FC<{
  plan: PlanPreview
  showHouse: boolean
  onSeparate?: () => void
  onRestore?: () => void
}> = ({ plan, showHouse, onSeparate, onRestore }) => (
  <div className="w-36 text-xs text-gray-600 space-y-1">
    {plan.image ? (
      <a href={resolveMediaUrl(plan.image)} target="_blank" rel="noreferrer" title="Открыть чертёж">
        <img
          src={resolveMediaUrl(plan.thumb)}
          alt={plan.planName}
          loading="lazy"
          className="w-36 h-28 object-contain rounded border border-gray-100 bg-gray-50"
        />
      </a>
    ) : (
      <div className="w-36 h-28 flex items-center justify-center rounded border border-dashed border-gray-200 text-gray-400">
        нет чертежа
      </div>
    )}
    <div className="font-medium text-gray-800 truncate" title={plan.planName}>
      {plan.planName}
    </div>
    <div>{formatAreaRange(plan.areaMin, plan.areaMax)}</div>
    <div>
      подъезд {plan.entrances.join(', ') || '—'} · кв. {plan.apartmentsCount}
      {plan.imagesCount > 1 && ` · чертежей ${plan.imagesCount}`}
    </div>
    {showHouse && plan.houseName && <div className="truncate">{plan.houseName}</div>}
    {onRestore ? (
      <button onClick={onRestore} className="flex items-center gap-1 text-primary-700 hover:underline">
        <Undo2 size={12} /> Вернуть в склейку
      </button>
    ) : (
      onSeparate && (
        <button onClick={onSeparate} className="flex items-center gap-1 text-gray-500 hover:text-gray-800">
          <Split size={12} /> Отделить
        </button>
      )
    )}
  </div>
)
