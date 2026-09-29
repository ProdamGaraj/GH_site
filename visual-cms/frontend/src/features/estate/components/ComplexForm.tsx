import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Save } from 'lucide-react'
import type { ComplexDetail, Locale, StatItem } from '../types'
import { estateApi } from '../api'
import { getT, setT, setLabel, isRu } from './tfield'
import { SECTION } from '../sections'
import { FormSection, TextField, TextArea, NumberField, SelectField, StringListField, StatsField, LabelMapField } from './fields'
import { GallerySlidesField } from './GallerySlidesField'
import { MediaField, MediaListField } from './mediaFields'
import { ProjectMapSection } from './ProjectMapSection'
import { SiteCardSection } from './SiteCardSection'

/**
 * Поля ЖК по разделам (база ru + переводы uz/en), каждый раздел — своя
 * карточка с якорем для меню.
 *
 * Кнопка «Сохранить ЖК» живёт в закреплённой полосе страницы (`actionsSlot`),
 * а черновик — здесь: форма держит его сама, чтобы перезагрузка домов его не
 * сбрасывала (см. EstateEditor). Без полосы кнопка стоит над разделами.
 */
export const ComplexForm: React.FC<{
  complex: ComplexDetail
  locale: Locale
  actionsSlot?: HTMLElement | null
}> = ({ complex, locale, actionsSlot }) => {
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
      // planGrouping правится своим разделом и своей кнопкой. Форма держит
      // значение с момента загрузки страницы, и без исключения «Сохранить ЖК»
      // молча откатывал бы свежую склейку.
      // windowViews — вычисляемый список для формы перевода, не поле ЖК.
      const { id, houses, planGrouping, windowViews, ...rest } = form as any
      await estateApi.updateComplex(complex.id, rest)
      setMsg('Сохранено')
    } catch (e: any) {
      setMsg(e?.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 3000)
    }
  }

  const actions = (
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
  )
  const translated = !isRu(locale)
  const setField = <K extends keyof ComplexDetail>(field: K) => (v: ComplexDetail[K]) =>
    setForm((f) => ({ ...f, [field]: v }))

  return (
    <div className="space-y-6">
      {actionsSlot ? createPortal(actions, actionsSlot) : <div className="flex justify-end">{actions}</div>}

      {/* Языконезависимые поля — только на вкладке ru */}
      {isRu(locale) && (
        <FormSection id={SECTION.basic} title="Основное">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <TextField label="Slug" hint="a-z, 0-9, дефис" value={form.slug} onChange={setField('slug')} />
            <SelectField
              label="Статус"
              value={form.status}
              options={[
                { value: 'active', label: 'Активен' },
                { value: 'sold_out', label: 'Распродано' },
              ]}
              onChange={setField('status')}
            />
            <NumberField label="Порядок" hint="на главной" value={form.order} onChange={(v) => setForm((f) => ({ ...f, order: v ?? 0 }))} />
            <NumberField
              label="ID дома в MacroCRM"
              hint="пусто — без синхронизации"
              value={form.externalHouseId ?? null}
              onChange={(v) => setForm((f) => ({ ...f, externalHouseId: v ?? null }))}
            />
          </div>
        </FormSection>
      )}

      <SiteCardSection form={form} setForm={setForm} locale={locale} />

      <FormSection id={SECTION.texts} title={translated ? 'Тексты — перевод' : 'Тексты'}>
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Название" {...tprops('name')} />
          <TextField label="Класс" {...tprops('className')} />
        </div>
        <TextArea label="Интро" {...tprops('intro')} />
        <div className="grid xl:grid-cols-2 gap-4">
          <TextArea label="О проекте" rows={5} {...tprops('about')} />
          <TextArea label="О проекте (доп.)" rows={5} {...tprops('aboutExtra')} />
        </div>
        <div className="grid xl:grid-cols-2 gap-4 items-start">
          <StatsField label="Параметры (stats)" value={tarr<StatItem[]>('stats')} onChange={(v) => setArr('stats', v)} />
          <TextArea label="Локация — текст" rows={4} {...tprops('locationText')} />
        </div>

        {/* Виды из окна приходят из CRM по-русски; переводятся словарём на весь
            ЖК, одним местом для карточек и чипсов фильтра. */}
        {translated && (form.windowViews?.length ?? 0) > 0 && (
          <LabelMapField
            label="Виды из окна"
            hint="перевод значений из CRM (пусто = ru)"
            keys={form.windowViews!}
            value={(getT(form, 'windowViewLabels', locale) as Record<string, string>) ?? {}}
            onChange={(key, text) =>
              setArr(
                'windowViewLabels' as keyof ComplexDetail,
                setLabel(getT(form, 'windowViewLabels', locale) as Record<string, string>, key, text)
              )
            }
          />
        )}
      </FormSection>

      <FormSection id={SECTION.yard} title={translated ? 'Двор — перевод' : 'Двор'}>
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Надзаголовок" {...tprops('yardEyebrow')} />
          <TextField label="Заголовок" {...tprops('yardTitle')} />
        </div>
        <div className="grid xl:grid-cols-2 gap-4 items-start">
          <TextArea label="Текст" rows={4} {...tprops('yardText')} />
          <StringListField
            label="Удобства"
            rows={4}
            value={tarr<string[]>('yardFeatures')}
            onChange={(v) => setArr('yardFeatures', v)}
          />
        </div>
      </FormSection>

      <ProjectMapSection form={form} setForm={setForm} locale={locale} />

      {/* Медиа — языконезависимо */}
      {isRu(locale) && (
        <FormSection id={SECTION.media} title="Медиа">
          <div className="grid lg:grid-cols-2 2xl:grid-cols-3 gap-x-6 gap-y-5 items-start">
            <MediaField label="Логотип" value={form.logo} onChange={setField('logo')} />
            <MediaField label="About-медиа" value={form.media} onChange={setField('media')} />
            <MediaField
              label="About-видео"
              hint="если «О проекте — слайды» пусто"
              kind="video"
              value={form.aboutVideo}
              onChange={setField('aboutVideo')}
            />
            <MediaField label="Картинка карты" value={form.mapImage} onChange={setField('mapImage')} />
            <TextField label="CSS-класс логотипа" value={form.logoClass} onChange={setField('logoClass')} />
            <TextField label="Ссылка на карту" value={form.mapUrl} onChange={setField('mapUrl')} />
          </div>
          <MediaListField label="Hero-изображения" value={form.heroImages} onChange={setField('heroImages')} />
          {/* Слайдеры страницы проекта: по ссылке на строку, фото или видео
              (.mp4/.webm). Порядок строк — порядок слайдов; при одном элементе
              навигации нет. Под списком — кадрирование каждого слайда.
              Поведение слайдера — в редакторе CMS. */}
          <GallerySlidesField
            label="О проекте — слайды"
            hint="фото и видео; пусто — About-видео, без него About-медиа"
            value={form.gallery}
            onChange={setField('gallery')}
          />
          <GallerySlidesField label="Холлы — слайды" hint="фото и видео" value={form.hallGallery} onChange={setField('hallGallery')} />
          <GallerySlidesField label="Двор — слайды" hint="фото и видео" value={form.yardGallery} onChange={setField('yardGallery')} />
        </FormSection>
      )}
    </div>
  )
}
