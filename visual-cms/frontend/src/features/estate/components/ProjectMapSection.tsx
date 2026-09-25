import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, MapPin, Plus, Trash2 } from 'lucide-react'
import type { ComplexDetail, GeoPoint, Locale, MapPlace, PlaceType } from '../types'
import { estateApi } from '../api'
import { movePlace, newPlace, removePlace, updatePlace } from '../projectMap'
import { getT, isRu, setLabel, setT } from './tfield'
import { CoordinatesField, Label, LabelMapField, TextField } from './fields'

const selectCls =
  'w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500'
const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

/**
 * Карта проекта в форме ЖК: точка дома, отдел продаж, места рядом.
 *
 * На вкладке ru — сами данные (сохраняются кнопкой «Сохранить ЖК» вместе с
 * остальной формой). На uz/en — переводы: адрес отдела продаж и названия мест
 * словарём по id места (placeNames). Типы мест общие для всех ЖК и правятся на
 * отдельной странице.
 */
export const ProjectMapSection: React.FC<{
  form: ComplexDetail
  setForm: React.Dispatch<React.SetStateAction<ComplexDetail>>
  locale: Locale
}> = ({ form, setForm, locale }) => {
  const [types, setTypes] = useState<PlaceType[]>([])
  const [typesError, setTypesError] = useState<string | null>(null)

  useEffect(() => {
    estateApi
      .listPlaceTypes()
      .then(setTypes)
      .catch((e) => setTypesError(e?.message || 'Не удалось загрузить типы мест'))
  }, [])

  const places = form.places ?? []
  const setPlaces = (next: MapPlace[]) => setForm((f) => ({ ...f, places: next }))

  if (!isRu(locale)) {
    const names = (getT(form, 'placeNames', locale) as Record<string, string> | undefined) ?? {}
    const byId = new Map(places.map((p) => [p.id, p.name]))
    return (
      <section className="space-y-4 pt-4 border-t border-gray-100" data-testid="project-map">
        <h3 className="text-sm font-semibold text-gray-500 uppercase">Карта проекта — перевод</h3>
        {form.salesOffice && (
          <TextField
            label="Адрес отдела продаж"
            hint="перевод (пусто = ru)"
            value={(getT(form, 'salesOfficeAddress', locale) as string) ?? ''}
            placeholder={form.salesOffice.address ?? ''}
            onChange={(v) => setForm((f) => setT(f, 'salesOfficeAddress', locale, v))}
          />
        )}
        {places.length > 0 ? (
          <LabelMapField
            label="Названия мест"
            hint="перевод (пусто = ru)"
            keys={places.map((p) => p.id)}
            labelOf={(id) => byId.get(id) ?? id}
            value={names}
            onChange={(id, text) => setForm((f) => setT(f, 'placeNames', locale, setLabel(names, id, text)))}
          />
        ) : (
          <p className="text-sm text-gray-400">Мест рядом пока нет — переводить нечего.</p>
        )}
      </section>
    )
  }

  const setOffice = (point: GeoPoint | null) =>
    setForm((f) => ({
      ...f,
      salesOffice: point ? { ...point, address: f.salesOffice?.address ?? '' } : null,
    }))

  return (
    <section className="space-y-4 pt-4 border-t border-gray-100" data-testid="project-map">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-500 uppercase flex items-center gap-2">
          <MapPin size={14} /> Карта проекта
        </h3>
        <Link to="/estate/place-types" className="text-sm text-primary-700 hover:underline">
          Типы мест
        </Link>
      </div>

      <CoordinatesField
        label="Точка дома"
        hint="центр карты; без неё карты на странице нет"
        value={form.housePoint}
        allowEmpty
        onChange={(point) => setForm((f) => ({ ...f, housePoint: point }))}
      />

      <div className="grid grid-cols-2 gap-4">
        <CoordinatesField
          label="Отдел продаж"
          hint="для кнопок «Такси» и «Маршрут»"
          value={form.salesOffice}
          allowEmpty
          onChange={setOffice}
        />
        <TextField
          label="Адрес отдела продаж"
          value={form.salesOffice?.address ?? ''}
          disabled={!form.salesOffice}
          placeholder={form.salesOffice ? 'ул. Навои, 1' : 'сначала координаты'}
          onChange={(v) =>
            setForm((f) => (f.salesOffice ? { ...f, salesOffice: { ...f.salesOffice, address: v } } : f))
          }
        />
      </div>

      <div>
        <Label hint="школы, детсады, больницы… — по одному на строку">Места рядом</Label>
        {typesError && <p className="text-sm text-red-600">{typesError}</p>}
        <div className="space-y-2">
          {places.map((place, index) => (
            <PlaceRow
              key={place.id}
              place={place}
              types={types}
              first={index === 0}
              last={index === places.length - 1}
              onChange={(patch) => setPlaces(updatePlace(places, place.id, patch))}
              onMove={(step) => setPlaces(movePlace(places, place.id, step))}
              onRemove={() => setPlaces(removePlace(places, place.id))}
            />
          ))}
          <NewPlaceRow types={types} onAdd={(place) => setPlaces([...places, place])} />
        </div>
      </div>
    </section>
  )
}

function typeLabel(type: PlaceType): string {
  return type.hidden ? `${type.nameRu} (скрыт с карты)` : type.nameRu
}

const TypeSelect: React.FC<{
  types: PlaceType[]
  value: string
  onChange: (key: string) => void
}> = ({ types, value, onChange }) => {
  const known = types.some((t) => t.key === value)
  return (
    <select className={selectCls} value={value} aria-label="Тип места" onChange={(e) => onChange(e.target.value)}>
      {!value && <option value="">Тип…</option>}
      {value && !known && <option value={value}>{value} (нет в справочнике)</option>}
      {types.map((t) => (
        <option key={t.key} value={t.key}>
          {typeLabel(t)}
        </option>
      ))}
    </select>
  )
}

const PlaceRow: React.FC<{
  place: MapPlace
  types: PlaceType[]
  first: boolean
  last: boolean
  onChange: (patch: Partial<Omit<MapPlace, 'id'>>) => void
  onMove: (step: -1 | 1) => void
  onRemove: () => void
}> = ({ place, types, first, last, onChange, onMove, onRemove }) => {
  // Название правится черновиком: пустое не принимается и при уходе с поля
  // возвращается прежнее — место без названия на карте было бы безымянной точкой.
  const [name, setName] = useState(place.name)
  const commitName = () => {
    if (name.trim()) onChange({ name })
    else setName(place.name)
  }
  return (
    <div className="grid grid-cols-[10rem_1fr_14rem_auto] gap-2 items-start" data-testid={`place-${place.id}`}>
      <TypeSelect types={types} value={place.type} onChange={(type) => onChange({ type })} />
      <input
        className={inputCls}
        value={name}
        aria-label="Название места"
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
      />
      <CoordinatesField value={place} onChange={(point) => point && onChange(point)} />
      <div className="flex items-center gap-1 pt-2">
        <button
          type="button"
          disabled={first}
          onClick={() => onMove(-1)}
          className="text-gray-500 disabled:opacity-30"
          aria-label="Выше"
        >
          <ArrowUp size={16} />
        </button>
        <button
          type="button"
          disabled={last}
          onClick={() => onMove(1)}
          className="text-gray-500 disabled:opacity-30"
          aria-label="Ниже"
        >
          <ArrowDown size={16} />
        </button>
        <button type="button" onClick={onRemove} className="text-red-500" aria-label="Удалить место">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}

/** Новое место добавляется только целиком: тип, название, разобранные координаты. */
const NewPlaceRow: React.FC<{
  types: PlaceType[]
  onAdd: (place: MapPlace) => void
}> = ({ types, onAdd }) => {
  const [type, setType] = useState('')
  const [name, setName] = useState('')
  const [point, setPoint] = useState<GeoPoint | null>(null)
  const [reset, setReset] = useState(0)
  const ready = Boolean(type && name.trim() && point)

  const add = () => {
    if (!ready) return
    onAdd(newPlace(type, name, point!))
    setName('')
    setPoint(null)
    setReset((n) => n + 1)
  }

  return (
    <div
      className="grid grid-cols-[10rem_1fr_14rem_auto] gap-2 items-start pt-2 border-t border-dashed border-gray-200"
      data-testid="new-place"
    >
      <TypeSelect types={types} value={type} onChange={setType} />
      <input
        className={inputCls}
        value={name}
        placeholder="Название, например «Школа №12»"
        aria-label="Название нового места"
        onChange={(e) => setName(e.target.value)}
      />
      <CoordinatesField key={reset} value={point} allowEmpty onChange={setPoint} />
      <button
        type="button"
        onClick={add}
        disabled={!ready}
        className="mt-1 flex items-center gap-1 px-3 py-2 text-sm rounded-md bg-primary-600 text-white disabled:opacity-40"
      >
        <Plus size={14} /> Добавить
      </button>
    </div>
  )
}
