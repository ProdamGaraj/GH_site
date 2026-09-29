import React from 'react'
import type { ComplexDetail, Locale } from '../types'
import { getT, isRu, setT } from './tfield'
import { SECTION } from '../sections'
import { CheckboxField, FormSection, SelectField, StringListField } from './fields'
import { MediaField } from './mediaFields'

/** Класс карточки для фильтра на главной — те же ключи, что у кнопок фильтра. */
const FILTER_CLASSES = [
  { value: 'comfort', label: 'Комфорт' },
  { value: 'business', label: 'Бизнес' },
  { value: 'premium', label: 'Премиум' },
]

/**
 * Проект на сайте: выставлен ли он и как выглядит его карточка на главной.
 *
 * «Показывать на сайте» решает и карточку, и страницу проекта: публичное API
 * estate отдаёт только выставленные ЖК. Распроданность — поле «Статус» выше:
 * тег «Распродано» карточка и страница получают сами.
 *
 * На вкладке ru — всё; на uz/en — перевод тегов (остальное языка не имеет).
 * Пустой перевод не сохраняется, и на сайте остаются теги ru.
 */
export const SiteCardSection: React.FC<{
  form: ComplexDetail
  setForm: React.Dispatch<React.SetStateAction<ComplexDetail>>
  locale: Locale
}> = ({ form, setForm, locale }) => {
  const baseTags = form.cardTags ?? []

  if (!isRu(locale)) {
    const translated = (getT(form, 'cardTags', locale) as string[] | undefined) ?? []
    return (
      <FormSection id={SECTION.card} title="Карточка на главной — перевод" testId="site-card">
        <StringListField
          label="Теги карточки"
          hint={baseTags.length ? `по одному в строке; ru: ${baseTags.join(', ')}` : 'по одному в строке'}
          value={translated}
          onChange={(v) => setForm((f) => setT(f, 'cardTags', locale, v.length ? v : undefined))}
        />
      </FormSection>
    )
  }

  return (
    <FormSection id={SECTION.card} title="Сайт и карточка на главной" testId="site-card">
      <div className="grid lg:grid-cols-2 2xl:grid-cols-3 gap-x-6 gap-y-5 items-start">
        <div className="space-y-4">
          <CheckboxField
            label="Показывать на сайте"
            hint="карточка на главной и страница проекта"
            checked={form.showOnSite ?? false}
            onChange={(v) => setForm((f) => ({ ...f, showOnSite: v }))}
          />
          <SelectField
            label="Класс для фильтра на главной"
            value={form.filterClass || 'business'}
            options={FILTER_CLASSES}
            onChange={(v) => setForm((f) => ({ ...f, filterClass: v }))}
          />
        </div>
        <MediaField
          label="Картинка карточки"
          hint="пусто — About-медиа"
          value={form.cardImage}
          onChange={(v) => setForm((f) => ({ ...f, cardImage: v }))}
        />
        <StringListField
          label="Теги карточки"
          hint="по одному в строке; «Распродано» появится сам"
          rows={4}
          value={baseTags}
          onChange={(v) => setForm((f) => ({ ...f, cardTags: v }))}
        />
      </div>
    </FormSection>
  )
}
