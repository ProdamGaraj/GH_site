import React, { useEffect, useRef, useState } from 'react'
import { cn } from '@/shared/utils'
import type { EstateSection } from '../sections'

/** Запас под линией чтения: раздел, доехавший почти до неё, уже текущий. */
export const READING_TOLERANCE = 24

/**
 * Раздел, который сейчас читают: последний, чей верх уже поднялся до линии
 * чтения. Так раздел остаётся текущим, пока читаешь его середину.
 *
 * Страницу прокручивает не окно, а контейнер под шапкой CMS, поэтому
 * прокрутка ловится на фазе перехвата — она не всплывает.
 */
export function useActiveSection(ids: readonly string[], readingLine: () => number): string | undefined {
  const [active, setActive] = useState<string | undefined>(ids[0])
  const key = ids.join('|')

  useEffect(() => {
    const update = () => {
      const line = readingLine()
      let current = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) current = id
      }
      setActive(current)
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return active
}

/** Меню разделов редактора ЖК: переход по клику, текущий раздел подсвечен. */
export const SectionNav: React.FC<{ sections: readonly EstateSection[] }> = ({ sections }) => {
  const list = useRef<HTMLUListElement>(null)
  // Линия чтения — верх самого меню: оно закреплено с тем же отступом, с каким
  // встаёт раздел после перехода (top-24 и scroll-mt-24), так что не зависит
  // от высоты шапки CMS и полосы над формой.
  const active = useActiveSection(
    sections.map((s) => s.id),
    () => (list.current?.getBoundingClientRect().top ?? 0) + READING_TOLERANCE
  )

  const go = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    // Без смены адреса: якорь в URL не нужен, а роутер его бы запомнил.
    event.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav aria-label="Разделы ЖК" className="hidden lg:block">
      <ul ref={list} className="sticky top-24 space-y-1">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={(e) => go(e, s.id)}
              aria-current={active === s.id ? 'location' : undefined}
              className={cn(
                'block rounded-md px-3 py-2 text-sm transition-colors',
                active === s.id
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
