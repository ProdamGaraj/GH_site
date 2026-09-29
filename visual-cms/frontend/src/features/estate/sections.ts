import type { Locale } from './types'
import { isRu } from './components/tfield'

/** Якоря разделов редактора ЖК — id карточек разделов на странице. */
export const SECTION = {
  basic: 'estate-basic',
  card: 'estate-card',
  texts: 'estate-texts',
  yard: 'estate-yard',
  map: 'estate-map',
  media: 'estate-media',
  plans: 'estate-plans',
  houses: 'estate-houses',
} as const

export interface EstateSection {
  id: string
  label: string
  /** Раздел только на вкладке ru: у его полей нет перевода (slug, статус, медиа). */
  ruOnly?: boolean
}

/** Меню разделов слева: порядок — порядок на странице. */
export const ESTATE_SECTIONS: readonly EstateSection[] = [
  { id: SECTION.basic, label: 'Основное', ruOnly: true },
  { id: SECTION.card, label: 'Сайт и карточка' },
  { id: SECTION.texts, label: 'Тексты' },
  { id: SECTION.yard, label: 'Двор' },
  { id: SECTION.map, label: 'Карта' },
  { id: SECTION.media, label: 'Медиа', ruOnly: true },
  { id: SECTION.plans, label: 'Планировки на сайте' },
  { id: SECTION.houses, label: 'Дома / корпуса' },
]

/** Разделы, которые есть на вкладке языка. */
export function sectionsFor(locale: Locale): EstateSection[] {
  return ESTATE_SECTIONS.filter((s) => isRu(locale) || !s.ruOnly)
}
