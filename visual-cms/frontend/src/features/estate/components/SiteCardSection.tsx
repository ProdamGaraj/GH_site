import React from 'react'
import type { ComplexDetail, Locale } from '../types'
import { getT, isRu, setT } from './tfield'
import { CheckboxField, SelectField, StringListField } from './fields'
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
      <section className="space-y-4 pt-4 border-t border-gray-100" data-testid="site-card">
        <h3 className="text-sm font-semibold text-gray-500 uppercase">Карточка на главной — перевод</h3>
        <StringListField
          label="Теги карточки"
          hint={baseTags.length ? `по одному в строке; ru: ${baseTags.join(', ')}` : 'по одному в строке'}
          value={translated}
          onChange={(v) => setForm((f) => setT(f, 'cardTags', locale, v.length ? v : undefined))}
        />
      </section>
    )
  }

  return (
    <section className="space-y-4 pt-4 border-t border-gray-100" data-testid="site-card">
      <h3 className="text-sm font-semibold text-gray-500 uppercase">Сайт и карточка на главной</h3>
      <CheckboxField
        label="Показывать на сайте"
        hint="карточка на главной и страница проекта"
        checked={form.showOnSite ?? false}
        onChange={(v) => setForm((f) => ({ ...f, showOnSite: v }))}
      />
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Класс для фильтра на главной"
          value={form.filterClass || 'business'}
          options={FILTER_CLASSES}
          onChange={(v) => setForm((f) => ({ ...f, filterClass: v }))}
        />
        <MediaField
          label="Картинка карточки"
          hint="пусто — About-медиа"
          value={form.cardImage}
          onChange={(v) => setForm((f) => ({ ...f, cardImage: v }))}
        />
      </div>
      <StringListField
        label="Теги карточки"
        hint="по одному в строке; «Распродано» у распроданного проекта появится сам"
        value={baseTags}
        onChange={(v) => setForm((f) => ({ ...f, cardTags: v }))}
      />
    </section>
  )
}
