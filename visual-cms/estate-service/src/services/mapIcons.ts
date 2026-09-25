/**
 * Иконки мест на карте проекта — единственный источник набора.
 *
 * Админка берёт из него список для выбора иконки типа (GET /api/admin/map-icons),
 * DTO проекта кладёт готовый SVG в легенду карты. У CMS и рантайма карты
 * своих копий нет: иначе наборы разъехались бы.
 *
 * Внутренности SVG — из Lucide (lucide-static 0.460.0), 24×24, контурные.
 * SVG вставляется на страницу как разметка: это безопасно, потому что набор
 * задан здесь, в коде, а не приходит от пользователя.
 *
 * Lucide — ISC License. Copyright (c) for portions of Lucide are held by
 * Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for
 * Lucide are held by Lucide Contributors 2022. Permission to use, copy,
 * modify, and/or distribute this software for any purpose with or without fee
 * is hereby granted, provided that the above copyright notice and this
 * permission notice appear in all copies.
 */

export interface MapIcon {
  /** Ключ иконки — хранится у типа места. */
  key: string
  /** Подпись в выборе иконки. */
  label: string
  /** Содержимое <svg>: контуры 24×24. */
  body: string
}

export const MAP_ICONS: readonly MapIcon[] = [
  { key: 'school', label: 'Школа', body: '<path d="M14 22v-4a2 2 0 1 0-4 0v4"/> <path d="m18 10 3.447 1.724a1 1 0 0 1 .553.894V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7.382a1 1 0 0 1 .553-.894L6 10"/> <path d="M18 5v17"/> <path d="m4 6 7.106-3.553a2 2 0 0 1 1.788 0L20 6"/> <path d="M6 5v17"/> <circle cx="12" cy="9" r="2"/>' },
  { key: 'baby', label: 'Детский сад', body: '<path d="M9 12h.01"/> <path d="M15 12h.01"/> <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/> <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>' },
  { key: 'graduation-cap', label: 'Вуз', body: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/> <path d="M22 10v6"/> <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>' },
  { key: 'hospital', label: 'Больница', body: '<path d="M12 6v4"/> <path d="M14 14h-4"/> <path d="M14 18h-4"/> <path d="M14 8h-4"/> <path d="M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2"/> <path d="M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18"/>' },
  { key: 'stethoscope', label: 'Поликлиника', body: '<path d="M11 2v2"/> <path d="M5 2v2"/> <path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/> <path d="M8 15a6 6 0 0 0 12 0v-3"/> <circle cx="20" cy="10" r="2"/>' },
  { key: 'pill', label: 'Аптека', body: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/> <path d="m8.5 8.5 7 7"/>' },
  { key: 'trees', label: 'Парк', body: '<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/> <path d="M7 16v6"/> <path d="M13 19v3"/> <path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>' },
  { key: 'train-front', label: 'Метро', body: '<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/> <path d="m9 15-1-1"/> <path d="m15 15 1-1"/> <path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/> <path d="m8 19-2 3"/> <path d="m16 19 2 3"/>' },
  { key: 'bus', label: 'Остановка', body: '<path d="M8 6v6"/> <path d="M15 6v6"/> <path d="M2 12h19.6"/> <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/> <circle cx="7" cy="18" r="2"/> <path d="M9 18h5"/> <circle cx="16" cy="18" r="2"/>' },
  { key: 'shopping-cart', label: 'Магазин', body: '<circle cx="8" cy="21" r="1"/> <circle cx="19" cy="21" r="1"/> <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>' },
  { key: 'shopping-bag', label: 'Торговый центр', body: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/> <path d="M3 6h18"/> <path d="M16 10a4 4 0 0 1-8 0"/>' },
  { key: 'coffee', label: 'Кафе', body: '<path d="M10 2v2"/> <path d="M14 2v2"/> <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/> <path d="M6 2v2"/>' },
  { key: 'utensils', label: 'Ресторан', body: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/> <path d="M7 2v20"/> <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>' },
  { key: 'dumbbell', label: 'Спорт', body: '<path d="M14.4 14.4 9.6 9.6"/> <path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z"/> <path d="m21.5 21.5-1.4-1.4"/> <path d="M3.9 3.9 2.5 2.5"/> <path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z"/>' },
  { key: 'landmark', label: 'Банк', body: '<line x1="3" x2="21" y1="22" y2="22"/> <line x1="6" x2="6" y1="18" y2="11"/> <line x1="10" x2="10" y1="18" y2="11"/> <line x1="14" x2="14" y1="18" y2="11"/> <line x1="18" x2="18" y1="18" y2="11"/> <polygon points="12 2 20 7 4 7"/>' },
  { key: 'moon-star', label: 'Мечеть', body: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9"/> <path d="M20 3v4"/> <path d="M22 5h-4"/>' },
  { key: 'square-parking', label: 'Парковка', body: '<rect width="18" height="18" x="3" y="3" rx="2"/> <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>' },
  { key: 'fuel', label: 'АЗС', body: '<line x1="3" x2="15" y1="22" y2="22"/> <line x1="4" x2="14" y1="9" y2="9"/> <path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/> <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>' },
  { key: 'building-2', label: 'Бизнес-центр', body: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/> <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/> <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/> <path d="M10 6h4"/> <path d="M10 10h4"/> <path d="M10 14h4"/> <path d="M10 18h4"/>' },
  { key: 'theater', label: 'Культура', body: '<path d="M2 10s3-3 3-8"/> <path d="M22 10s-3-3-3-8"/> <path d="M10 2c0 4.4-3.6 8-8 8"/> <path d="M14 2c0 4.4 3.6 8 8 8"/> <path d="M2 10s2 2 2 5"/> <path d="M22 10s-2 2-2 5"/> <path d="M8 15h8"/> <path d="M2 22v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"/> <path d="M14 22v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"/>' },
  { key: 'map-pin', label: 'Точка', body: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/> <circle cx="12" cy="10" r="3"/>' },
  { key: 'house', label: 'Дом', body: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/> <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' },
  { key: 'handshake', label: 'Отдел продаж', body: '<path d="m11 17 2 2a1 1 0 1 0 3-3"/> <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/> <path d="m21 3 1 11h-2"/> <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/> <path d="M3 4h8"/>' },
]

const BY_KEY = new Map(MAP_ICONS.map((icon) => [icon.key, icon]))

export function isMapIcon(key: unknown): key is string {
  return typeof key === 'string' && BY_KEY.has(key)
}

/** Готовый <svg> иконки (размер задаёт CSS); неизвестный ключ — null. */
export function iconSvg(key: string): string | null {
  const icon = BY_KEY.get(key)
  if (!icon) return null
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    icon.body +
    '</svg>'
  )
}
