import React, { useState } from 'react'
import { Save } from 'lucide-react'
import type { ComplexDetail, Locale, StatItem } from '../types'
import { estateApi } from '../api'
import { getT, setT, isRu } from './tfield'
import { TextField, TextArea, NumberField, SelectField, StringListField, StatsField } from './fields'

/** Панель редактирования полей ЖК (база ru + переводы uz/en). */
export const ComplexForm: React.FC<{ complex: ComplexDetail; locale: Locale }> = ({ complex, locale }) => {
  const [form, setForm] = useState<ComplexDetail>(complex)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // Переводимое текстовое поле, привязанное к активному языку.
  const tprops = (field: keyof ComplexDetail) => ({
    value: (getT(form, field as string, locale) as string) ?? '',
    onChange: (v: string) => setForm((f) => setT(f, field as string, locale, v)),
    hint: !isRu(locale) ? 'перевод (пусто = ru)' : undefined,
    placeholder: !isRu(locale) ? String((form as any)[field] ?? '') : undefined,
  })
  const tarr = <T,>(field: keyof ComplexDetail): T =>
    ((getT(form, field as string, locale) as T) ?? (isRu(locale) ? (form as any)[field] : ([] as any))) as T
  const setArr = (field: keyof ComplexDetail, v: unknown) =>
    setForm((f) => setT(f, field as string, locale, v))

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const { id, houses, ...rest } = form as any
      await estateApi.updateComplex(complex.id, rest)
      setMsg('Сохранено')
    } catch (e: any) {
      setMsg(e?.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 3000)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Комплекс</h2>
        <div className="flex items-center gap-3">
          {msg && <span className="text-sm text-gray-500">{msg}</span>}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50"
          >
            <Save size={16} /> Сохранить ЖК
          </button>
        </div>
      </div>

      {/* Языконезависимые поля — только на вкладке ru */}
      {isRu(locale) && (
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Slug"
            hint="a-z, 0-9, дефис"
            value={form.slug}
            onChange={(v) => setForm((f) => ({ ...f, slug: v }))}
          />
          <SelectField
            label="Статус"
            value={form.status}
            options={[
              { value: 'active', label: 'Активен' },
              { value: 'sold_out', label: 'Sold out' },
            ]}
            onChange={(v) => setForm((f) => ({ ...f, status: v }))}
          />
          <NumberField label="Порядок" value={form.order} onChange={(v) => setForm((f) => ({ ...f, order: v ?? 0 }))} />
        </div>
      )}

      {/* Переводимые текстовые поля */}
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Название" {...tprops('name')} />
        <TextField label="Класс" {...tprops('className')} />
      </div>
      <TextArea label="Интро" {...tprops('intro')} />
      <TextArea label="О проекте" {...tprops('about')} />
      <TextArea label="О проекте (доп.)" {...tprops('aboutExtra')} />

      <div className="grid grid-cols-2 gap-4">
        <TextField label="Двор — надзаголовок" {...tprops('yardEyebrow')} />
        <TextField label="Двор — заголовок" {...tprops('yardTitle')} />
      </div>
      <TextArea label="Двор — текст" {...tprops('yardText')} />
      <StringListField
        label="Двор — удобства"
        value={tarr<string[]>('yardFeatures')}
        onChange={(v) => setArr('yardFeatures', v)}
      />
      <StatsField label="Параметры (stats)" value={tarr<StatItem[]>('stats')} onChange={(v) => setArr('stats', v)} />
      <TextArea label="Локация — текст" {...tprops('locationText')} />

      {/* Медиа — языконезависимо */}
      {isRu(locale) && (
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-500 uppercase">Медиа (URL)</h3>
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Логотип" value={form.logo} onChange={(v) => setForm((f) => ({ ...f, logo: v }))} />
            <TextField label="CSS-класс логотипа" value={form.logoClass} onChange={(v) => setForm((f) => ({ ...f, logoClass: v }))} />
            <TextField label="About-медиа" value={form.media} onChange={(v) => setForm((f) => ({ ...f, media: v }))} />
            <TextField label="About-видео" value={form.aboutVideo} onChange={(v) => setForm((f) => ({ ...f, aboutVideo: v }))} />
            <TextField label="Ссылка на карту" value={form.mapUrl} onChange={(v) => setForm((f) => ({ ...f, mapUrl: v }))} />
            <TextField label="Картинка карты" value={form.mapImage} onChange={(v) => setForm((f) => ({ ...f, mapImage: v }))} />
          </div>
          <StringListField label="Hero-изображения" value={form.heroImages} onChange={(v) => setForm((f) => ({ ...f, heroImages: v }))} />
          <StringListField label="Галерея двора" value={form.yardGallery} onChange={(v) => setForm((f) => ({ ...f, yardGallery: v }))} />
          <StringListField label="Галерея холлов" value={form.hallGallery} onChange={(v) => setForm((f) => ({ ...f, hallGallery: v }))} />
          <StringListField label="Общая галерея" value={form.gallery} onChange={(v) => setForm((f) => ({ ...f, gallery: v }))} />
        </div>
      )}
    </div>
  )
}
