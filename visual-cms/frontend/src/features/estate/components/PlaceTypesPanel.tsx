import React, { useEffect, useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { ApiError } from '@/shared/api/http'
import type { MapIconOption, PlaceType } from '../types'
import { estateApi } from '../api'

const inputCls =
  'w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

const KEY_RE = /^[a-z][a-z0-9-]{1,39}$/
const COLOR_RE = /^#[0-9a-fA-F]{6}$/

/** Правимые поля типа: ключ неизменен — на него ссылаются места у ЖК. */
type Editable = Omit<PlaceType, 'key'>

function editable(type: PlaceType): Editable {
  const { key: _key, ...rest } = type
  return rest
}

function sameType(a: Editable, b: Editable): boolean {
  return (Object.keys(a) as Array<keyof Editable>).every((k) => a[k] === b[k])
}

/**
 * Типы мест на карте проекта — общие для всех ЖК.
 *
 * Иконка — из набора estate-service (единственный источник), цвет — метка и
 * кружок легенды. Тип, которым пользуются места, сервер не удалит (409 со
 * списком ЖК): такой тип скрывают флажком — места остаются в данных.
 */
export const PlaceTypesPanel: React.FC = () => {
  const [types, setTypes] = useState<PlaceType[]>([])
  const [icons, setIcons] = useState<MapIconOption[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([estateApi.listPlaceTypes(), estateApi.listMapIcons()])
      .then(([t, i]) => {
        setTypes(t)
        setIcons(i)
      })
      .catch((e) => setError(e?.message || 'Не удалось загрузить типы мест'))
  }, [])

  const replace = (saved: PlaceType) => setTypes((list) => list.map((t) => (t.key === saved.key ? saved : t)))

  const remove = async (type: PlaceType) => {
    if (!window.confirm(`Удалить тип «${type.nameRu}»?`)) return
    try {
      await estateApi.deletePlaceType(type.key)
      setTypes((list) => list.filter((t) => t.key !== type.key))
    } catch (e) {
      const complexes =
        (e instanceof ApiError && e.status === 409 && (e.details as { complexes?: string[] })?.complexes) || null
      window.alert(
        complexes
          ? `Тип «${type.nameRu}» используется местами в ЖК: ${complexes.join(', ')}.\n\nЧтобы убрать его с карты и не потерять места, отметьте «скрыт».`
          : (e as Error)?.message || 'Не получилось удалить',
      )
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Типы мест на карте</h1>
        <p className="text-sm text-gray-500 mt-1">
          Общие для всех ЖК: школа, детсад, больница… Иконка и цвет — у метки на карте и в легенде.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        <div className="grid grid-cols-[3rem_1fr_1fr_1fr_7rem_4rem_4rem_auto] gap-2 px-4 py-2 text-xs font-medium text-gray-500 uppercase">
          <span>Иконка</span>
          <span>Название</span>
          <span>UZ</span>
          <span>EN</span>
          <span>Цвет</span>
          <span>Порядок</span>
          <span>Скрыт</span>
          <span />
        </div>
        {types.map((type) => (
          <PlaceTypeRow key={type.key} type={type} icons={icons} onSaved={replace} onRemove={() => remove(type)} />
        ))}
      </div>

      <NewPlaceType icons={icons} onCreated={(t) => setTypes((list) => [...list, t])} taken={types.map((t) => t.key)} />
    </div>
  )
}

const IconPicker: React.FC<{
  icons: MapIconOption[]
  value: string
  color: string
  onChange: (key: string) => void
}> = ({ icons, value, color, onChange }) => {
  const [open, setOpen] = useState(false)
  const current = icons.find((i) => i.key === value)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 rounded-full grid place-items-center text-white"
        style={{ background: color }}
        title={current?.label ?? value}
        aria-label={`Иконка: ${current?.label ?? value}`}
      >
        <span className="w-5 h-5 block" dangerouslySetInnerHTML={{ __html: current?.svg ?? '' }} />
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-72 p-2 bg-white border border-gray-200 rounded-lg shadow-lg grid grid-cols-6 gap-1">
          {icons.map((icon) => (
            <button
              key={icon.key}
              type="button"
              title={icon.label}
              aria-label={icon.label}
              onClick={() => {
                onChange(icon.key)
                setOpen(false)
              }}
              className={`w-10 h-10 rounded-md grid place-items-center ${icon.key === value ? 'bg-primary-50 ring-2 ring-primary-500' : 'hover:bg-gray-100'}`}
            >
              <span className="w-5 h-5 block text-gray-700" dangerouslySetInnerHTML={{ __html: icon.svg }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const ColorField: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <div className="flex items-center gap-1">
    <input
      type="color"
      value={COLOR_RE.test(value) ? value : '#000000'}
      onChange={(e) => onChange(e.target.value)}
      className="w-8 h-8 p-0 border-0 bg-transparent"
      aria-label="Цвет"
    />
    <input className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Цвет, hex" />
  </div>
)

const PlaceTypeRow: React.FC<{
  type: PlaceType
  icons: MapIconOption[]
  onSaved: (type: PlaceType) => void
  onRemove: () => void
}> = ({ type, icons, onSaved, onRemove }) => {
  const [draft, setDraft] = useState<Editable>(editable(type))
  const [saving, setSaving] = useState(false)
  const dirty = !sameType(draft, editable(type))
  const valid = draft.nameRu.trim() !== '' && COLOR_RE.test(draft.color)
  const set = (patch: Partial<Editable>) => setDraft((d) => ({ ...d, ...patch }))

  const save = async () => {
    setSaving(true)
    try {
      onSaved(await estateApi.updatePlaceType(type.key, draft))
    } catch (e) {
      window.alert((e as Error)?.message || 'Не получилось сохранить')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="grid grid-cols-[3rem_1fr_1fr_1fr_7rem_4rem_4rem_auto] gap-2 px-4 py-2 items-center"
      data-testid={`type-${type.key}`}
    >
      <IconPicker icons={icons} value={draft.icon} color={draft.color} onChange={(icon) => set({ icon })} />
      <input
        className={inputCls}
        value={draft.nameRu}
        onChange={(e) => set({ nameRu: e.target.value })}
        aria-label="Название"
      />
      <input
        className={inputCls}
        value={draft.nameUz}
        onChange={(e) => set({ nameUz: e.target.value })}
        aria-label="Название UZ"
      />
      <input
        className={inputCls}
        value={draft.nameEn}
        onChange={(e) => set({ nameEn: e.target.value })}
        aria-label="Название EN"
      />
      <ColorField value={draft.color} onChange={(color) => set({ color })} />
      <input
        className={inputCls}
        type="number"
        value={draft.order}
        onChange={(e) => set({ order: Number(e.target.value) || 0 })}
        aria-label="Порядок"
      />
      <input
        type="checkbox"
        checked={draft.hidden}
        onChange={(e) => set({ hidden: e.target.checked })}
        aria-label="Скрыт с карты"
        className="justify-self-center"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || !valid || saving}
          className="text-primary-700 disabled:opacity-30"
          aria-label="Сохранить тип"
        >
          <Save size={16} />
        </button>
        <button type="button" onClick={onRemove} className="text-red-500" aria-label="Удалить тип">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}

const NewPlaceType: React.FC<{ icons: MapIconOption[]; taken: string[]; onCreated: (type: PlaceType) => void }> = ({
  icons,
  taken,
  onCreated,
}) => {
  const empty = {
    key: '',
    nameRu: '',
    nameUz: '',
    nameEn: '',
    icon: 'map-pin',
    color: '#5a6b85',
    order: 0,
    hidden: false,
  }
  const [draft, setDraft] = useState<PlaceType>(empty)
  const keyTaken = taken.includes(draft.key)
  const valid = KEY_RE.test(draft.key) && !keyTaken && draft.nameRu.trim() !== '' && COLOR_RE.test(draft.color)
  const set = (patch: Partial<PlaceType>) => setDraft((d) => ({ ...d, ...patch }))

  const create = async () => {
    try {
      onCreated(await estateApi.createPlaceType(draft))
      setDraft(empty)
    } catch (e) {
      window.alert((e as Error)?.message || 'Не получилось создать тип')
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2" data-testid="new-type">
      <h2 className="text-sm font-semibold text-gray-700">Новый тип</h2>
      <div className="grid grid-cols-[3rem_1fr_1fr_7rem_auto] gap-2 items-center">
        <IconPicker icons={icons} value={draft.icon} color={draft.color} onChange={(icon) => set({ icon })} />
        <input
          className={inputCls}
          value={draft.key}
          placeholder="ключ латиницей: kids-club"
          aria-label="Ключ нового типа"
          onChange={(e) => set({ key: e.target.value.trim().toLowerCase() })}
        />
        <input
          className={inputCls}
          value={draft.nameRu}
          placeholder="Название: Детский клуб"
          aria-label="Название нового типа"
          onChange={(e) => set({ nameRu: e.target.value })}
        />
        <ColorField value={draft.color} onChange={(color) => set({ color })} />
        <button
          type="button"
          onClick={create}
          disabled={!valid}
          className="flex items-center gap-1 px-3 py-2 text-sm rounded-md bg-primary-600 text-white disabled:opacity-40"
        >
          <Plus size={14} /> Добавить
        </button>
      </div>
      {draft.key && !KEY_RE.test(draft.key) && (
        <p className="text-xs text-red-600">Ключ: латиница, цифры и дефис, от 2 символов. Потом его не поменять.</p>
      )}
      {keyTaken && <p className="text-xs text-red-600">Тип с таким ключом уже есть.</p>}
    </div>
  )
}
