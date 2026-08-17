import React, { useState } from 'react'
import { Save, Trash2 } from 'lucide-react'
import type { Apartment, Locale } from '../types'
import { estateApi } from '../api'
import { getT, setT, isRu } from './tfield'
import { TextField, NumberField, SelectField, StringListField } from './fields'

/** Форма квартиры (внутри дома). Сохраняет/удаляет саму себя. */
export const ApartmentForm: React.FC<{
  apartment: Apartment
  locale: Locale
  onChanged: () => void
}> = ({ apartment, locale, onChanged }) => {
  const [form, setForm] = useState<Apartment>(apartment)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const tprops = (field: keyof Apartment) => ({
    value: (getT(form, field as string, locale) as string) ?? '',
    onChange: (v: string) => setForm((f) => setT(f, field as string, locale, v)),
    placeholder: !isRu(locale) ? String((form as any)[field] ?? '') : undefined,
  })
  const badges = (): string[] =>
    ((getT(form, 'badges', locale) as string[]) ?? (isRu(locale) ? form.badges : [])) || []

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const { id, houseId, translations, ...base } = form as any
      await estateApi.updateApartment(apartment.id, { ...base, translations })
      setMsg('✓')
      onChanged()
    } catch (e: any) {
      setMsg(e?.message || 'ошибка')
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 2500)
    }
  }

  const remove = async () => {
    if (!confirm(`Удалить квартиру №${form.number || ''}?`)) return
    await estateApi.deleteApartment(apartment.id)
    onChanged()
  }

  return (
    <div className="bg-gray-50 rounded-md border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">
          Квартира №{form.number || '—'} ({form.rooms}к / {String(form.areaM2)} м²)
        </span>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-gray-500">{msg}</span>}
          <button onClick={save} disabled={saving} className="text-primary-600 hover:text-primary-800 disabled:opacity-50">
            <Save size={15} />
          </button>
          <button onClick={remove} className="text-red-500 hover:text-red-700">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {isRu(locale) && (
        <div className="grid grid-cols-4 gap-3">
          <NumberField label="Комнат" value={form.rooms} onChange={(v) => setForm((f) => ({ ...f, rooms: v ?? 0 }))} />
          <NumberField label="Площадь м²" value={form.areaM2} onChange={(v) => setForm((f) => ({ ...f, areaM2: v ?? 0 }))} />
          <NumberField label="Цена UZS" value={form.price} onChange={(v) => setForm((f) => ({ ...f, price: v ?? 0 }))} />
          <NumberField label="Старая цена" value={form.oldPrice} onChange={(v) => setForm((f) => ({ ...f, oldPrice: v }))} />
          <TextField label="Этаж (8/9)" value={form.floor} onChange={(v) => setForm((f) => ({ ...f, floor: v }))} />
          <TextField label="Номер" value={form.number} onChange={(v) => setForm((f) => ({ ...f, number: v }))} />
          <NumberField label="Подъезд" value={form.entrance} onChange={(v) => setForm((f) => ({ ...f, entrance: v }))} />
          <NumberField label="Порядок" value={form.order} onChange={(v) => setForm((f) => ({ ...f, order: v ?? 0 }))} />
          <SelectField
            label="Статус"
            value={form.status}
            options={[
              { value: 'available', label: 'В продаже' },
              { value: 'sold', label: 'Продана' },
            ]}
            onChange={(v) => setForm((f) => ({ ...f, status: v }))}
          />
          <TextField label="План (URL)" value={form.planImage} onChange={(v) => setForm((f) => ({ ...f, planImage: v }))} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <TextField label="Класс" {...tprops('apartmentClass')} />
        <TextField label="Срок сдачи" {...tprops('deadline')} />
        <TextField label="Плашка предложения" {...tprops('offerLabel')} />
      </div>
      <StringListField label="Бейджи" value={badges()} onChange={(v) => setForm((f) => setT(f, 'badges', locale, v))} rows={2} />
    </div>
  )
}
