import React, { useState } from 'react'
import { Save, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import type { House, Locale } from '../types'
import { estateApi } from '../api'
import { getT, setT, isRu } from './tfield'
import { TextField, NumberField } from './fields'
import { ApartmentForm } from './ApartmentForm'

/** Карточка дома/корпуса: поля + список квартир. Сохраняет/удаляет себя. */
export const HouseCard: React.FC<{
  house: House
  locale: Locale
  onChanged: () => void
}> = ({ house, locale, onChanged }) => {
  const [form, setForm] = useState<House>(house)
  const [open, setOpen] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const tprops = (field: keyof House) => ({
    value: (getT(form, field as string, locale) as string) ?? '',
    onChange: (v: string) => setForm((f) => setT(f, field as string, locale, v)),
    placeholder: !isRu(locale) ? String((form as any)[field] ?? '') : undefined,
  })

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const { id, complexId, apartments, translations, ...base } = form as any
      await estateApi.updateHouse(house.id, { ...base, translations })
      setMsg('✓ сохранён')
    } catch (e: any) {
      setMsg(e?.message || 'ошибка')
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 2500)
    }
  }

  const remove = async () => {
    if (!confirm(`Удалить дом «${form.name}» со всеми квартирами?`)) return
    await estateApi.deleteHouse(house.id)
    onChanged()
  }

  const addApartment = async () => {
    await estateApi.createApartment(house.id, {
      rooms: 1,
      areaM2: 0,
      price: 0,
      number: '',
      order: (house.apartments?.length || 0),
    })
    onChanged()
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-left">
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <span className="font-medium text-gray-900">{form.name || 'Дом'}</span>
          <span className="text-sm text-gray-400">
            {form.floors ? `${form.floors} эт.` : ''} · {form.apartments?.length || 0} кв.
          </span>
        </button>
        <div className="flex items-center gap-3">
          {msg && <span className="text-xs text-gray-500">{msg}</span>}
          <button onClick={save} disabled={saving} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 disabled:opacity-50">
            <Save size={15} /> Сохранить
          </button>
          <button onClick={remove} className="text-red-500 hover:text-red-700">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Название" {...tprops('name')} />
            <TextField label="Этажность" hint='напр. "16" или "9 и 16"' {...tprops('floors')} />
            <TextField label="Срок сдачи" {...tprops('deadline')} />
            <TextField label="Класс" {...tprops('className')} />
            {isRu(locale) && (
              <>
                <NumberField label="Подъездов" value={form.entrances} onChange={(v) => setForm((f) => ({ ...f, entrances: v }))} />
                <NumberField label="Порядок" value={form.order} onChange={(v) => setForm((f) => ({ ...f, order: v ?? 0 }))} />
              </>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-500 uppercase">Квартиры</h4>
              <button onClick={addApartment} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800">
                <Plus size={15} /> Добавить квартиру
              </button>
            </div>
            {(form.apartments || []).map((apt) => (
              <ApartmentForm key={apt.id} apartment={apt} locale={locale} onChanged={onChanged} />
            ))}
            {(form.apartments || []).length === 0 && (
              <p className="text-sm text-gray-400">Пока нет квартир.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
