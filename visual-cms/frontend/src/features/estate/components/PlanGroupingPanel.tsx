import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Eye, EyeOff, Merge, Pencil, RotateCcw, Save, Split, Undo2 } from 'lucide-react'
import { resolveMediaUrl } from '@/shared/api/mediaApi'
import { cn } from '@/shared/utils'
import type { PlanGroupOverride, PlanGroupingConfig, PlanGroupPreview, PlanGroupingPreview, PlanPreview } from '../types'
import { estateApi } from '../api'
import {
  BADGE_LOCALES,
  BadgeLocale,
  OverrideListField,
  OverrideNumberField,
  Parsed,
  PlanGroupingDraft,
  dropNames,
  forgetOverride,
  formatAreaRange,
  formatNumberList,
  hasCrmOverride,
  mergeCards,
  overrideProblems,
  parseArea,
  parseBadges,
  parseNumberList,
  resetToCrm,
  restorePlan,
  roomsLabel,
  sameConfig,
  separatePlan,
  setBadges,
  setGroupHidden,
  setOverrideField,
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
  /** Меняется после синхронизации с CRM: пересчитать превью по свежим данным. */
  refreshToken?: number
}> = ({ complexId, initial, refreshToken = 0 }) => {
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
  // «От» больше «до» в ручных данных: сервер такое не примет — ни пересчёта, ни сохранения.
  const problems = useMemo(() => overrideProblems(draft), [draft])
  const blocked = Object.keys(problems).length > 0

  // Пересчёт при каждой правке черновика. Устаревший ответ отменяется, чтобы
  // медленный запрос не перетёр более свежий.
  useEffect(() => {
    if (blocked) return
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complexId, draft, refreshToken])

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
            disabled={!dirty || saving || blocked}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50"
          >
            <Save size={16} /> Сохранить
          </button>
        </div>
      </div>
      {msg && <p className="text-sm text-gray-600">{msg}</p>}
      {blocked && (
        <p className="text-sm text-red-600">Исправьте ручные данные групп — пока в них ошибка, сохранить нельзя.</p>
      )}

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

      {/* Сеткой: карточка планировки узкая, по одной в строку на широком экране пустело. */}
      <div className={`grid xl:grid-cols-2 2xl:grid-cols-3 gap-3 items-start ${loading ? 'opacity-60' : ''}`}>
        {preview?.groups.map((group) => {
          const key = cardKey(group)
          const names = group.plans.map((p) => p.planName)
          // Правка группы: та, что применилась, или новая — под главной планировкой.
          const overrideKey = group.overrideKey ?? group.anchor
          return (
            <PlanCard
              key={key}
              group={group}
              override={draft.overrides[overrideKey] ?? null}
              problem={problems[overrideKey]}
              checked={selected.has(key)}
              showHouse={multipleHouses}
              onToggle={() => toggle(key)}
              onSeparate={(name) => edit(separatePlan(draft, name))}
              onRestore={(name) => edit(restorePlan(draft, name))}
              onUngroup={() => edit(ungroupCard(draft, names))}
              onHidden={(hidden) => edit(setGroupHidden(draft, names, hidden))}
              onField={(field, value) => edit(setOverrideField(draft, overrideKey, field, value))}
              onBadges={(locale, list) => edit(setBadges(draft, overrideKey, locale, list))}
              onResetCrm={() => edit(resetToCrm(draft, overrideKey))}
              onForget={(name) => edit(forgetOverride(draft, name))}
            />
          )
        })}
        {preview && preview.groups.length === 0 && (
          <p className="text-sm text-gray-400 xl:col-span-2 2xl:col-span-3">
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
  /** Ручные данные группы из черновика; null — всё из CRM. */
  override: PlanGroupOverride | null
  /** Ошибка в ручных данных («от» больше «до»). */
  problem?: string
  checked: boolean
  showHouse: boolean
  onToggle: () => void
  onSeparate: (name: string) => void
  onRestore: (name: string) => void
  onUngroup: () => void
  onHidden: (hidden: boolean) => void
  onField: (field: OverrideNumberField | OverrideListField, value: number | number[] | undefined) => void
  onBadges: (locale: BadgeLocale, list: string[]) => void
  onResetCrm: () => void
  onForget: (name: string) => void
}> = ({
  group,
  override,
  problem,
  checked,
  showHouse,
  onToggle,
  onSeparate,
  onRestore,
  onUngroup,
  onHidden,
  onField,
  onBadges,
  onResetCrm,
  onForget,
}) => {
  const [editing, setEditing] = useState(false)
  const several = group.plans.length > 1
  const local = (field: keyof PlanGroupOverride) => override?.[field] !== undefined
  const badges = override?.badges?.ru ?? []
  return (
    <div
      data-testid="plan-group"
      className={cn(
        'rounded-lg border p-4 flex gap-3',
        checked ? 'border-primary-400 ring-2 ring-primary-100' : 'border-gray-200',
        group.hidden && 'bg-gray-50'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label="Выбрать для объединения"
        className="mt-1 h-4 w-4 shrink-0"
      />
      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={cn('font-medium', group.hidden ? 'text-gray-400' : 'text-gray-900')}>
            {roomsLabel(group.rooms, group.isStudio)} {formatAreaRange(group.areaMin, group.areaMax)}
          </span>
          {group.manual && (
            <span className="px-2 py-0.5 rounded bg-primary-50 text-primary-700 text-xs">вручную</span>
          )}
          <div className="ml-auto flex items-center gap-3">
            {group.manual && (
              <button onClick={onUngroup} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
                <Undo2 size={14} /> Распустить
              </button>
            )}
            <button
              onClick={() => onHidden(!group.hidden)}
              aria-pressed={!group.hidden}
              title={group.hidden ? 'Вернуть группу на сайт' : 'Скрыть группу с сайта'}
              className={cn(
                'flex items-center gap-1 text-sm px-2 py-1 rounded-md',
                group.hidden ? 'bg-gray-200 text-gray-600 hover:bg-gray-300' : 'text-green-700 hover:bg-green-50'
              )}
            >
              {group.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
              {group.hidden ? 'Скрыта' : 'На сайте'}
            </button>
          </div>
        </div>

        <dl className={cn('flex flex-wrap gap-x-4 gap-y-1 text-sm', group.hidden ? 'text-gray-400' : 'text-gray-600')}>
          <Fact label="Площадь" local={local('areaMin') || local('areaMax')}>
            {formatAreaRange(group.areaMin, group.areaMax)}
          </Fact>
          <Fact label="Этажи" local={local('floors')}>
            {formatNumberList(group.floors)}
          </Fact>
          <Fact label="Подъезды" local={local('entrances')}>
            {formatNumberList(group.entrances)}
          </Fact>
          <Fact label="В продаже">{group.apartmentsCount}</Fact>
        </dl>

        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {badges.map((badge) => (
              <span key={badge} className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-xs font-medium">
                {badge}
              </span>
            ))}
          </div>
        )}

        {group.ignoredOverrides.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            <AlertTriangle size={14} />
            В группе есть ещё ручные данные планировок {group.ignoredOverrides.join(', ')} — они не применяются.
            {group.ignoredOverrides.map((name) => (
              <button key={name} onClick={() => onForget(name)} className="underline hover:no-underline">
                Забыть {name}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setEditing((v) => !v)}
            aria-expanded={editing}
            className="flex items-center gap-1 text-sm text-primary-700 hover:text-primary-900"
          >
            <Pencil size={14} /> {editing ? 'Свернуть' : 'Изменить данные'}
          </button>
          {/* Кнопка на месте всегда, чтобы её не искать; без ручных данных — неактивна. */}
          <button
            onClick={onResetCrm}
            disabled={!hasCrmOverride(override)}
            title={
              hasCrmOverride(override)
                ? 'Снять ручные площадь, этажи и подъезды группы — вернуть данные CRM. Бейджи останутся.'
                : 'Все данные группы и так из CRM'
            }
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            <RotateCcw size={14} /> Вернуть данные из CRM
          </button>
        </div>
        {problem && <p className="text-sm text-red-600">{problem}</p>}

        {editing && (
          <GroupEditor group={group} override={override} onField={onField} onBadges={onBadges} />
        )}

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

/** Значение карточки с пометкой, откуда оно: из CRM или ручное. */
const Fact: React.FC<{ label: string; local?: boolean; children: React.ReactNode }> = ({ label, local, children }) => (
  <div className="flex items-center gap-1">
    <dt className="text-gray-400">{label}</dt>
    <dd className={cn(local && 'font-medium text-amber-800')}>{children}</dd>
    {local && <span className="px-1 rounded bg-amber-100 text-amber-800 text-[10px] uppercase">локально</span>}
  </div>
)

/**
 * Ручные данные группы. Пустое поле — значение из CRM (серым в поле),
 * заполненное — главнее CRM, рядом видно значение CRM.
 */
const GroupEditor: React.FC<{
  group: PlanGroupPreview
  override: PlanGroupOverride | null
  onField: (field: OverrideNumberField | OverrideListField, value: number | number[] | undefined) => void
  onBadges: (locale: BadgeLocale, list: string[]) => void
}> = ({ group, override, onField, onBadges }) => {
  const crm = group.crm
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-3" data-testid="group-editor">
      <div className="grid grid-cols-2 gap-3">
        <OverrideInput
          label="Площадь от, м²"
          crmText={String(crm.areaMin)}
          value={override?.areaMin}
          format={String}
          parse={parseArea}
          onCommit={(v) => onField('areaMin', v)}
        />
        <OverrideInput
          label="Площадь до, м²"
          crmText={String(crm.areaMax)}
          value={override?.areaMax}
          format={String}
          parse={parseArea}
          onCommit={(v) => onField('areaMax', v)}
        />
        <OverrideInput
          label="Этажи"
          hint="«2–16» или «2, 5, 7»"
          crmText={formatNumberList(crm.floors)}
          value={override?.floors}
          format={formatNumberList}
          parse={parseNumberList}
          onCommit={(v) => onField('floors', v)}
        />
        <OverrideInput
          label="Подъезды"
          hint="«1, 3»"
          crmText={formatNumberList(crm.entrances)}
          value={override?.entrances}
          format={formatNumberList}
          parse={parseNumberList}
          onCommit={(v) => onField('entrances', v)}
        />
      </div>
      <div className="space-y-2">
        <span className="block text-xs font-medium text-gray-700">
          Бейджи на карточке <span className="font-normal text-gray-400">через запятую; пустой UZ/EN — на сайте RU</span>
        </span>
        {BADGE_LOCALES.map((locale) => (
          <BadgesInput
            key={locale}
            locale={locale}
            value={override?.badges?.[locale] ?? []}
            onCommit={(list) => onBadges(locale, list)}
          />
        ))}
      </div>
    </div>
  )
}

const inputCls =
  'w-full px-2.5 py-1.5 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500'

/**
 * Поле ручного значения. Текст живёт в поле; в черновик уходит только
 * разобранное значение: недописанное («2–») не портит данные, поле подсвечено.
 */
function OverrideInput<T>({
  label,
  hint,
  crmText,
  value,
  format,
  parse,
  onCommit,
}: {
  label: string
  hint?: string
  crmText: string
  value: T | undefined
  format: (v: T) => string
  parse: (text: string) => Parsed<T>
  onCommit: (v: T | undefined) => void
}) {
  const external = value === undefined ? '' : format(value)
  const [text, setText] = useState(external)
  const parsed = parse(text)
  // Внешняя смена (сброс к CRM, другой черновик) — переписываем поле, но не
  // перебиваем то, что человек сейчас набирает и что значит то же самое.
  useEffect(() => {
    const mine = parsed.ok && parsed.value !== undefined ? format(parsed.value) : ''
    if (mine !== external) setText(external)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [external])

  const local = value !== undefined
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1">
        {label}
        {local ? (
          <span className="px-1 rounded bg-amber-100 text-amber-800 text-[10px] uppercase">локально</span>
        ) : (
          <span className="px-1 rounded bg-gray-200 text-gray-600 text-[10px] uppercase">CRM</span>
        )}
      </span>
      <input
        className={cn(inputCls, parsed.ok ? (local ? 'border-amber-300' : 'border-gray-300') : 'border-red-400')}
        value={text}
        placeholder={crmText || '—'}
        aria-label={label}
        aria-invalid={!parsed.ok}
        onChange={(e) => {
          const next = e.target.value
          setText(next)
          const result = parse(next)
          if (result.ok) onCommit(result.value)
        }}
      />
      {/* Под полем: у ручного значения — что в CRM, иначе — формат ввода. */}
      {(local || hint) && (
        <span className="mt-0.5 block text-[11px] text-gray-400">{local ? `CRM: ${crmText || '—'}` : hint}</span>
      )}
    </label>
  )
}

const LOCALE_LABELS: Record<BadgeLocale, string> = { ru: 'RU', uz: 'UZ', en: 'EN' }

const BadgesInput: React.FC<{ locale: BadgeLocale; value: string[]; onCommit: (list: string[]) => void }> = ({
  locale,
  value,
  onCommit,
}) => {
  const external = value.join(', ')
  const [text, setText] = useState(external)
  useEffect(() => {
    if (parseBadges(text).join(', ') !== external) setText(external)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [external])
  return (
    <label className="flex items-center gap-2">
      <span className="w-7 text-xs font-medium text-gray-500">{LOCALE_LABELS[locale]}</span>
      <input
        className={cn(inputCls, 'border-gray-300')}
        value={text}
        placeholder={locale === 'ru' ? 'Акция, Последняя планировка' : 'пусто — как RU'}
        aria-label={`Бейджи ${LOCALE_LABELS[locale]}`}
        onChange={(e) => {
          setText(e.target.value)
          onCommit(parseBadges(e.target.value))
        }}
      />
    </label>
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
