import React, { useState } from 'react'
import { Save, Trash2, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import type { ComplexDetail, House, Locale } from '../types'
import { estateApi } from '../api'
import { apartmentSummary } from '../houseSummary'
import { SECTION } from '../sections'
import { getT, setT, isRu } from './tfield'
import { CheckboxField, NumberField, SelectField, StringListField, TextArea, TextField } from './fields'
import { MediaField } from './mediaFields'
import { FILTER_CLASSES } from './SiteCardSection'

/**
 * Дом / корпус — единица MacroCRM; проект объединяет дома.
 *
 * Из CRM: ID (по нему синхронизация), этажность, квартиры, срок сдачи. Срок
 * можно вписать вручную — он главнее CRM. Когда проект стоит на главной
 * карточками домов, у дома своя карточка: пустое поле берётся из проекта.
 *
 * Квартир списком здесь нет: они приходят из CRM, данные для сайта правятся у
 * групп планировок.
 */
export const HouseCard: React.FC<{
  house: House
  /** Проект дома: режим каталога и значения «как у проекта». */
  project: ComplexDetail
  locale: Locale
  onChanged: () => void
}> = ({ house, project, locale, onChanged }) => {
  const [form, setForm] = useState<House>(house)
  const [open, setOpen] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const ru = isRu(locale)
  const byHouses = project.catalogMode === 'houses'

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
      const { id, complexId, apartments, translations, crmDeadline, crmServiceYear, crmServiceMonth, ...base } =
        form as any
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
          {byHouses && house.showOnSite === false && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">не на главной</span>
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
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
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

          {byHouses ? (
            <HouseCardFields form={form} setForm={setForm} project={project} locale={locale} tprops={tprops} />
          ) : (
            <p className="text-xs text-gray-400">
              Проект стоит на главной одной карточкой — карточка дома не используется. Показать дома отдельными
              карточками: «Сайт и карточка» → «На главной».
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** Карточка дома на главной: своё поле главнее, пустое — как у проекта. */
const HouseCardFields: React.FC<{
  form: House
  setForm: React.Dispatch<React.SetStateAction<House>>
  project: ComplexDetail
  locale: Locale
  tprops: (field: keyof House, fallback?: string) => {
    value: string
    onChange: (v: string) => void
    placeholder: string
    hint: string | undefined
  }
}> = ({ form, setForm, project, locale, tprops }) => {
  const ru = isRu(locale)
  const projectTags = project.cardTags ?? []
  const houseTags = ((ru ? form.cardTags : getT(form, 'cardTags', locale)) as string[] | undefined) ?? []
  const tagsHint = `пусто — как у проекта${projectTags.length ? `: ${projectTags.join(', ')}` : ''}`
  const projectFilter = FILTER_CLASSES.find((c) => c.value === (project.filterClass || 'business'))?.label ?? ''

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-4" data-testid="house-card-fields">
      <h4 className="text-xs font-semibold uppercase text-gray-500">
        Карточка дома на главной{ru ? '' : ' — перевод'}
      </h4>
      {ru && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 items-end">
          <CheckboxField
            label="Показывать на главной"
            checked={form.showOnSite !== false}
            onChange={(v) => setForm((f) => ({ ...f, showOnSite: v }))}
          />
          <SelectField
            label="Статус"
            value={form.status || 'active'}
            options={[
              { value: 'active', label: 'Продаётся' },
              { value: 'sold_out', label: 'Распродано' },
            ]}
            onChange={(v) => setForm((f) => ({ ...f, status: v }))}
          />
          <SelectField
            label="Класс для фильтра"
            value={form.filterClass || ''}
            options={[{ value: '', label: `Как у проекта (${projectFilter})` }, ...FILTER_CLASSES]}
            onChange={(v) => setForm((f) => ({ ...f, filterClass: v }))}
          />
          <TextField label="Класс на карточке" {...tprops('className', project.className)} />
        </div>
      )}
      {!ru && <TextField label="Класс на карточке" {...tprops('className', project.className)} />}
      <div className="grid xl:grid-cols-2 gap-4 items-start">
        <TextArea label="Описание" rows={3} {...tprops('intro', project.intro)} />
        <StringListField
          label="Теги"
          hint={tagsHint}
          value={houseTags}
          onChange={(v) =>
            setForm((f) => (ru ? { ...f, cardTags: v } : setT(f, 'cardTags', locale, v.length ? v : undefined)))
          }
        />
      </div>
      {ru && (
        <MediaField
          label="Картинка карточки"
          hint="пусто — как у проекта"
          value={form.cardImage ?? ''}
          onChange={(v) => setForm((f) => ({ ...f, cardImage: v }))}
        />
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
  const [externalId, setExternalId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const add = async () => {
    if (!externalId) return
    setBusy(true)
    setError(null)
    try {
      await estateApi.createHouse(complexId, { externalId, name: name.trim(), order: nextOrder })
      setExternalId(null)
      setName('')
      onAdded()
    } catch (e: any) {
      setError(e?.message || 'Не удалось добавить дом')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-dashed border-gray-300 p-4 space-y-2" data-testid="add-house">
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
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 disabled:opacity-50"
        >
          <Plus size={16} /> Добавить дом
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-400">
        После добавления нажмите «Синхронизировать проект» — придут квартиры, планировки и срок сдачи.
      </p>
    </div>
  )
}
