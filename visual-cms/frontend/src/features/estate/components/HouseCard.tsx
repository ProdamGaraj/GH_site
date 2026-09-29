import React, { useState } from 'react'
import { Save, Trash2, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import type { House, Locale } from '../types'
import { estateApi } from '../api'
import { apartmentSummary } from '../houseSummary'
import { SECTION } from '../sections'
import { getT, setT, isRu } from './tfield'
import { NumberField, TextField } from './fields'

/**
 * Дом / корпус — единица MacroCRM; проект объединяет дома.
 *
 * Из CRM: ID (по нему синхронизация), этажность, квартиры, срок сдачи. Срок
 * можно вписать вручную — он главнее CRM. Полей проекта дом не меняет:
 * страница и карточка на главной — у проекта, дом даёт им квартиры,
 * планировки и срок сдачи.
 *
 * Квартир списком здесь нет: они приходят из CRM, данные для сайта правятся у
 * групп планировок.
 */
export const HouseCard: React.FC<{
  house: House
  locale: Locale
  onChanged: () => void
}> = ({ house, locale, onChanged }) => {
  const [form, setForm] = useState<House>(house)
  const [open, setOpen] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const ru = isRu(locale)

  // Переводимое поле: на ru — база, на uz/en — перевод с подсказкой-оригиналом.
  const tprops = (field: keyof House, fallback = '') => ({
    value: (getT(form, field as string, locale) as string) ?? '',
    onChange: (v: string) => setForm((f) => setT(f, field as string, locale, v)),
    placeholder: ru ? fallback : String((form as any)[field] || fallback),
    hint: ru ? undefined : 'перевод (пусто = ru)',
  })

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      // Срок из CRM и квартиры пишет синхронизация, не форма.
      const { id, complexId, apartments, translations, crmDeadline, crmServiceYear, crmServiceMonth, ...base } = form as any
      await estateApi.updateHouse(house.id, { ...base, translations })
      setMsg('✓ сохранён')
      onChanged()
    } catch (e: any) {
      setMsg(e?.message || 'ошибка')
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 4000)
    }
  }

  const remove = async () => {
    if (
      !confirm(
        `Удалить дом «${form.name || 'без названия'}» вместе с его квартирами и планировками? ` +
          'Синхронизация их не вернёт, пока дом не заведут заново с тем же ID из MacroCRM.'
      )
    )
      return
    await estateApi.deleteHouse(house.id)
    onChanged()
  }

  // Поля могут отсутствовать, пока миграция estate не применена: не падаем.
  const crmDeadline = house.crmDeadline ?? ''
  const deadlineHint = (form.deadline ?? '').trim()
    ? `вручную · CRM: ${crmDeadline || '—'}`
    : crmDeadline
      ? 'из CRM'
      : 'в CRM нет — впишите вручную'

  return (
    <div className="bg-white rounded-lg border border-gray-200" data-testid="house-card">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-left min-w-0">
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <span className="font-medium text-gray-900 truncate">{form.name || 'Дом без названия'}</span>
          {house.externalId ? (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">CRM {house.externalId}</span>
          ) : (
            <span
              className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700"
              title="Без ID из MacroCRM дом не синхронизируется"
            >
              без CRM
            </span>
          )}
        </button>
        <div className="flex items-center gap-3">
          {msg && <span className="text-xs text-gray-500 max-w-[20rem] truncate" title={msg}>{msg}</span>}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 disabled:opacity-50"
          >
            <Save size={15} /> Сохранить
          </button>
          <button onClick={remove} className="text-red-500 hover:text-red-700" aria-label="Удалить дом">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
            {ru && (
              <NumberField
                label="ID дома в MacroCRM"
                hint="по нему синхронизация"
                value={form.externalId}
                onChange={(v) => setForm((f) => ({ ...f, externalId: v }))}
              />
            )}
            <TextField label="Название" {...tprops('name')} />
            <TextField
              label="Срок сдачи"
              {...tprops('deadline', crmDeadline)}
              hint={ru ? deadlineHint : 'перевод (пусто = ru, потом CRM)'}
            />
            <TextField label="Класс" {...tprops('className')} />
            {ru && (
              <NumberField
                label="Порядок"
                hint="среди домов проекта"
                value={form.order}
                onChange={(v) => setForm((f) => ({ ...f, order: v ?? 0 }))}
              />
            )}
          </div>

          <p className="text-sm text-gray-500" data-testid="house-apartments">
            {/* Из пропса, не из формы: после синхронизации сводка свежая без перемонтирования. */}
            {apartmentSummary(house.apartments)}
            {form.floors ? ` · этажей ${form.floors}` : ''}. Цены, этажи, подъезды и бейджи для сайта — у групп в разделе{' '}
            <a href={`#${SECTION.plans}`} className="text-primary-700 hover:underline">
              «Планировки на сайте»
            </a>
            .
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Новый дом в проекте — по ID из MacroCRM. Дом заводит админ, синхронизация
 * его наполняет квартирами, планировками и сроком сдачи.
 */
export const AddHouseForm: React.FC<{
  complexId: string
  nextOrder: number
  onAdded: () => void
}> = ({ complexId, nextOrder, onAdded }) => {
  // Свёрнута в кнопку: открытая форма с полями «ID» и «Название» выглядела
  // как ещё один дом под настоящими.
  const [open, setOpen] = useState(false)
  const [externalId, setExternalId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setOpen(false)
    setExternalId(null)
    setName('')
    setError(null)
  }

  const add = async () => {
    if (!externalId) return
    setBusy(true)
    setError(null)
    try {
      await estateApi.createHouse(complexId, { externalId, name: name.trim(), order: nextOrder })
      close()
      onAdded()
    } catch (e: any) {
      setError(e?.message || 'Не удалось добавить дом')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        data-testid="add-house-open"
        className="flex items-center gap-2 px-4 py-2 rounded-md text-sm text-primary-700 border border-dashed border-primary-300 hover:bg-primary-50"
      >
        <Plus size={16} /> Добавить дом
      </button>
    )
  }

  return (
    <div className="bg-primary-50/40 rounded-lg border border-dashed border-primary-300 p-4 space-y-3" data-testid="add-house">
      <h3 className="text-sm font-semibold text-gray-700">Новый дом</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <NumberField label="ID дома в MacroCRM" value={externalId} onChange={setExternalId} />
        </div>
        <div className="flex-1 min-w-[12rem]">
          <TextField label="Название" hint="пусто — из CRM при синхронизации" value={name} onChange={setName} />
        </div>
        <button
          onClick={add}
          disabled={!externalId || busy}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50"
        >
          <Plus size={16} /> Добавить
        </button>
        <button onClick={close} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800">
          Отмена
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-400">
        После добавления нажмите «Синхронизировать проект» — придут квартиры, планировки и срок сдачи.
      </p>
    </div>
  )
}
