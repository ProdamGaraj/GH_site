import { useAppSelector } from '@/app/hooks'
import { selectStandardMonitors, selectBreakpoints } from '@/features/editor/editorSlice'

/**
 * Ширины экранов проекта для генерации адаптивных вариантов изображений.
 *
 * Источник — настройки проекта: список поддерживаемых мониторов + брейкпоинты.
 * Объединяем оба (мониторы десктопные, брейкпоинты добавляют мобильные размеры),
 * дедупим и сортируем по убыванию. Бэкенд сам отсечёт ширины больше оригинала.
 */
export function useProjectVariantWidths(): number[] {
  const monitors = useAppSelector(selectStandardMonitors)
  const breakpoints = useAppSelector(selectBreakpoints)

  const widths = [
    ...monitors.map((m) => m.width),
    ...breakpoints.map((b) => b.width),
  ].filter((w) => Number.isFinite(w) && w > 0)

  return Array.from(new Set(widths)).sort((a, b) => b - a)
}
