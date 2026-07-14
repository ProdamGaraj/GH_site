import {
  FileText,
  Info,
  Move,
  Palette,
  Type,
  MousePointer,
  Zap,
  Code2,
  Database,
  GalleryHorizontal,
  Languages,
  History,
  type LucideIcon,
} from 'lucide-react'

/**
 * Единый реестр секций правой панели редактора. Один источник истины и для
 * сайдбара-шортката (RightSidebar), и для непрерывной ленты (Editor):
 * порядок здесь = порядок кнопок сверху вниз = порядок секций в ленте,
 * иначе scroll-spy подсвечивал бы не ту кнопку.
 */
export interface RightPanelSection {
  /** Совпадает с data-rp="<id>" секции в ленте. */
  id: string
  /** Подпись кнопки (title) и заголовок секции. */
  label: string
  icon: LucideIcon
  /** Секция только для редактора страниц (в редакторе блока скрыта). */
  pageOnly?: boolean
  /** Разделитель под кнопкой в сайдбаре. */
  dividerAfter?: boolean
  /** Цветовой акцент активной кнопки. */
  accent?: 'blue' | 'amber'
}

export const RIGHT_PANEL_SECTIONS: RightPanelSection[] = [
  { id: 'pageSettings', label: 'Настройки страницы', icon: FileText, pageOnly: true },
  { id: 'basicSettings', label: 'Основные настройки', icon: Info, dividerAfter: true },
  { id: 'positioning', label: 'Позиция и размеры', icon: Move },
  { id: 'colors', label: 'Цвета', icon: Palette },
  { id: 'content', label: 'Контент и текст', icon: Type },
  { id: 'states', label: 'Hover и состояния', icon: MousePointer },
  { id: 'animations', label: 'Анимации', icon: Zap },
  { id: 'scripts', label: 'Скрипты', icon: Code2 },
  { id: 'data', label: 'Привязка данных', icon: Database },
  { id: 'slides', label: 'Слайды карусели', icon: GalleryHorizontal },
  { id: 'translations', label: 'Переводы', icon: Languages, pageOnly: true, accent: 'blue' },
  { id: 'versionHistory', label: 'История версий', icon: History, pageOnly: true, accent: 'amber' },
  { id: 'css', label: 'CSS код', icon: Code2 },
]

/** Секции, видимые в текущем режиме (страница показывает всё, блок — без pageOnly). */
export function visibleRightPanelSections(mode: 'page' | 'block'): RightPanelSection[] {
  return RIGHT_PANEL_SECTIONS.filter((s) => mode === 'page' || !s.pageOnly)
}
