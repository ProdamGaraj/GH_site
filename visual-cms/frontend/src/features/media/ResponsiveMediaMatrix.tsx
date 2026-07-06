import React, { useMemo, useState } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { setNodeMediaOverride } from '@/features/editor/editorSlice'
import { saveTranslation, deleteTranslation, updateTranslationLocally } from '@/features/translations/translationsSlice'
import { MediaPicker } from '@/features/media/MediaPicker'
import { Image as ImageIcon, X, Monitor } from 'lucide-react'
import type { BlockNode } from '@/shared/types'
import { parseCssUrl, translationField, findOverride, type MediaSlot } from './responsiveMediaMatrix.utils'

/**
 * Матрица адаптивного медиа «экран × язык» для выбранного узла.
 *
 * Строки — экраны: «Базовый» (без брейкпоинта) + брейкпоинты по убыванию ширины.
 * Колонки — базовый язык (дизайн, пишется в дерево/variations) и активный язык
 * (перевод-оверлей). Каждая ячейка адресует ровно одно хранилище:
 *   базовый язык + базовый экран  → узел (attributes.src | styles.backgroundImage)
 *   базовый язык + экран B        → variations[B].inheritedOverrides[node]
 *   язык L + базовый экран        → Translation(L, node, 'src' | 'bg:image')
 *   язык L + экран B              → Translation(L, node, 'src@B' | 'bg:image@B')
 *
 * Приоритет разрешения пустых ячеек (язык→экран) — задача бэкенда (деплой/превью);
 * здесь правим только явные значения, не дублируя логику фолбэка.
 */

type Slot = MediaSlot

interface Breakpoint {
  id: string
  name: string
  width: number
}

interface Lang {
  code: string
  nativeName: string
  flag?: string
}

interface ResponsiveMediaMatrixProps {
  node: Pick<BlockNode, 'id' | 'tagName' | 'elementType' | 'attributes' | 'styles'>
  rootNode: BlockNode | null
  pageId: string
  siteId: string | null
  breakpoints: Breakpoint[]
  defaultLang?: Lang
  activeLang?: Lang
  activeLocale: string | null
  translationMap: Record<string, Record<string, string>>
}

export const ResponsiveMediaMatrix: React.FC<ResponsiveMediaMatrixProps> = ({
  node,
  rootNode,
  pageId,
  siteId,
  breakpoints,
  defaultLang,
  activeLang,
  activeLocale,
  translationMap,
}) => {
  const dispatch = useAppDispatch()
  const [picker, setPicker] = useState<{ bpId: string | null; col: 'base' | 'locale' } | null>(null)

  const tag = (node.tagName || '').toLowerCase()
  const isVideo = tag === 'video'
  // src-слот: <img>/<video> (у видео на деплое свап делает data-rmedia-рантайм).
  const slot: Slot = tag === 'img' || node.elementType === 'image' || isVideo ? 'src' : 'bg'

  // Строки: базовый экран + брейкпоинты по убыванию ширины.
  const rows = useMemo(
    () => [
      { id: null as string | null, name: 'Базовый' },
      ...[...breakpoints].sort((a, b) => b.width - a.width).map((b) => ({ id: b.id, name: `${b.name} (≤${b.width})` })),
    ],
    [breakpoints],
  )

  // Значение ячейки базового языка (голый URL).
  const baseValue = (bpId: string | null): string => {
    if (bpId === null) {
      return slot === 'src'
        ? node.attributes?.src || ''
        : parseCssUrl(node.styles?.properties?.backgroundImage) || ''
    }
    const ov = findOverride(rootNode, node.id, bpId)
    return slot === 'src' ? ov?.attributes?.src || '' : parseCssUrl(ov?.styles?.backgroundImage) || ''
  }

  // Значение ячейки активного языка (голый URL).
  const localeValue = (bpId: string | null): string =>
    translationMap[node.id]?.[translationField(slot, bpId)] || ''

  const setBase = (bpId: string | null, value: string) => {
    dispatch(setNodeMediaOverride({ nodeId: node.id, breakpoint: bpId, slot, value }))
  }

  const setLocale = (bpId: string | null, value: string) => {
    if (!activeLocale) return
    const field = translationField(slot, bpId)
    if (value) {
      dispatch(updateTranslationLocally({ nodeId: node.id, field, value }))
      dispatch(saveTranslation({ pageId, locale: activeLocale, nodeId: node.id, field, value }))
    } else {
      dispatch(deleteTranslation({ pageId, locale: activeLocale, nodeId: node.id, field }))
    }
  }

  const onPick = (url: string) => {
    if (!picker) return
    if (picker.col === 'base') setBase(picker.bpId, url)
    else setLocale(picker.bpId, url)
    setPicker(null)
  }

  const Cell: React.FC<{ bpId: string | null; col: 'base' | 'locale' }> = ({ bpId, col }) => {
    const value = col === 'base' ? baseValue(bpId) : localeValue(bpId)
    const disabled = col === 'locale' && !activeLocale
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setPicker({ bpId, col })}
          title={value || 'Выбрать медиа'}
          className={`flex-1 min-w-0 flex items-center gap-1 px-1.5 py-1 rounded border text-[10px] transition-colors ${
            value ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-dashed border-gray-300 text-gray-400'
          } ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-blue-400'}`}
        >
          <ImageIcon size={11} className="shrink-0" />
          <span className="truncate">{value ? value.split('/').pop() : 'Пусто'}</span>
        </button>
        {value && !disabled && (
          <button
            type="button"
            onClick={() => (col === 'base' ? setBase(bpId, '') : setLocale(bpId, ''))}
            title="Очистить"
            className="shrink-0 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <X size={11} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="border-b border-gray-200 p-2">
      <div className="flex items-center gap-2 mb-2">
        <Monitor size={12} className="text-blue-500" />
        <span className="text-[10px] font-semibold text-gray-600 uppercase">
          Адаптивное медиа · {slot === 'bg' ? 'Фон' : isVideo ? 'Видео' : 'Изображение'}
        </span>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[9px] text-gray-400 uppercase">
            <th className="text-left font-medium pb-1 w-16">Экран</th>
            <th className="text-left font-medium pb-1">
              {defaultLang?.flag} {defaultLang?.nativeName || 'Оригинал'}
            </th>
            <th className="text-left font-medium pb-1">
              {activeLang ? `${activeLang.flag || '🌐'} ${activeLang.nativeName}` : 'Язык не выбран'}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id ?? '__base__'} className="align-middle">
              <td className="text-[10px] text-gray-500 pr-1 py-0.5">{row.name}</td>
              <td className="py-0.5 pr-1">
                <Cell bpId={row.id} col="base" />
              </td>
              <td className="py-0.5">
                <Cell bpId={row.id} col="locale" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <MediaPicker
        open={picker !== null}
        kind={slot === 'bg' ? 'image' : isVideo ? 'video' : 'any'}
        siteId={siteId}
        title="Выберите медиа для ячейки"
        onClose={() => setPicker(null)}
        onSelect={(asset) => onPick(asset.url)}
      />
    </div>
  )
}
