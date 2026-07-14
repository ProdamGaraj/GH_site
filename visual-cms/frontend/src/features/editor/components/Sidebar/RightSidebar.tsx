import React from 'react'
import { visibleRightPanelSections } from '@/features/editor/rightPanelSections'

interface RightSidebarProps {
  mode?: 'page' | 'block'
  /** id секции, которая сейчас во вьюпорте ленты (scroll-spy). */
  activeSection?: string | null
  /** Проскроллить ленту к секции (и раскрыть панель, если свёрнута). */
  onNavigate?: (id: string) => void
}

/**
 * Сайдбар правой панели: кнопки-шорткаты к секциям непрерывной ленты.
 * Клик скроллит ленту к секции; активная кнопка подсвечивается по scroll-spy
 * (см. Editor). Раньше кнопки переключали единственную видимую панель — теперь
 * панель одна непрерывная, а кнопки лишь навигируют по ней.
 */
export const RightSidebar: React.FC<RightSidebarProps> = ({ mode = 'block', activeSection, onNavigate }) => {
  const sections = visibleRightPanelSections(mode)

  return (
    <div className="w-12 bg-gray-100 border-l border-gray-200 flex flex-col items-center py-2 gap-1 overflow-y-auto">
      {sections.map((s) => {
        const Icon = s.icon
        const active = activeSection === s.id
        const activeCls =
          s.accent === 'blue'
            ? 'bg-white shadow-sm text-blue-600 border border-blue-300'
            : s.accent === 'amber'
              ? 'bg-white shadow-sm text-amber-600 border border-amber-300'
              : 'bg-white shadow-sm text-gray-900 border border-gray-300'

        return (
          <React.Fragment key={s.id}>
            <button
              onClick={() => onNavigate?.(s.id)}
              className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
                active ? activeCls : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`}
              title={s.label}
              aria-current={active ? 'true' : undefined}
            >
              <Icon size={20} />
            </button>
            {s.dividerAfter && <div className="h-px w-8 bg-gray-300 my-1" />}
          </React.Fragment>
        )
      })}
    </div>
  )
}
