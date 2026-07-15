import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { selectRootNode, selectBreakpoints } from '@/features/editor/editorSlice'
import {
  saveTranslation,
  deleteTranslation,
  updateTranslationLocally,
} from '@/features/translations/translationsSlice'
import { usePageTranslations } from '@/features/translations/usePageTranslations'
import { ResponsiveMediaMatrix } from './ResponsiveMediaMatrix'
import { MediaPicker } from './MediaPicker'
import { Film, X, Image as ImageIcon } from 'lucide-react'
import type { BlockNode } from '@/shared/types'

interface MediaLanguageSectionProps {
  node: Pick<BlockNode, 'id' | 'tagName' | 'elementType' | 'attributes' | 'styles'>
  /** id страницы; в редакторе блока сюда попадает id блока — секция сама поймёт. */
  pageId?: string
}

/**
 * «Языки и экраны» для медиа узла — живёт там, где выбирается исходное медиа
 * (панель «Контент», слайды карусели), а не в панели «Переводы».
 *
 * Содержит: селектор активного языка, матрицу «экран × язык»
 * (ResponsiveMediaMatrix) и, для слайдов с видео-фоном, строку языкового
 * варианта data-slide-video. В редакторе блока (переводы page-scoped)
 * показывает только базовую колонку.
 */
export const MediaLanguageSection: React.FC<MediaLanguageSectionProps> = ({ node, pageId }) => {
  const dispatch = useAppDispatch()
  const rootNode = useAppSelector(selectRootNode)
  const breakpoints = useAppSelector(selectBreakpoints)
  const {
    isPage,
    siteId,
    defaultLang,
    nonDefaultLangs,
    activeLocale,
    activeLang,
    translationMap,
    setLocale,
  } = usePageTranslations(pageId)

  const [videoPickerOpen, setVideoPickerOpen] = useState(false)

  // В блоке переводов нет: матрица работает в базовом режиме (колонка языка выключена)
  const localeEnabled = isPage && nonDefaultLangs.length > 0
  const effectiveLocale = localeEnabled ? activeLocale : null

  const slideVideoBase = node.attributes?.['data-slide-video'] || ''
  const slideVideoLoc = effectiveLocale
    ? translationMap[node.id]?.['data-slide-video'] || ''
    : ''

  const setSlideVideoTranslation = (value: string) => {
    if (!effectiveLocale || !pageId) return
    if (value) {
      dispatch(updateTranslationLocally({ nodeId: node.id, field: 'data-slide-video', value }))
      dispatch(saveTranslation({ pageId, locale: effectiveLocale, nodeId: node.id, field: 'data-slide-video', value }))
    } else {
      dispatch(deleteTranslation({ pageId, locale: effectiveLocale, nodeId: node.id, field: 'data-slide-video' }))
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Селектор активного языка — общий для всех медиа-секций (slice) */}
      {localeEnabled && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
          <span className="text-[10px] font-semibold text-gray-500 uppercase">Язык варианта</span>
          <select
            value={activeLocale || ''}
            onChange={(e) => setLocale(e.target.value || null)}
            className="ml-auto px-2 py-0.5 text-xs border border-gray-300 rounded bg-white text-gray-800"
          >
            <option value="">— не выбран —</option>
            {nonDefaultLangs.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag || '🌐'} {l.nativeName}
              </option>
            ))}
          </select>
        </div>
      )}

      <ResponsiveMediaMatrix
        node={node}
        rootNode={rootNode}
        pageId={isPage && pageId ? pageId : ''}
        siteId={siteId}
        breakpoints={breakpoints}
        defaultLang={defaultLang}
        activeLang={effectiveLocale ? activeLang : undefined}
        activeLocale={effectiveLocale}
        translationMap={translationMap}
      />

      {/* Видео-фон слайда: языковой вариант data-slide-video (per-breakpoint у него нет) */}
      {slideVideoBase && (
        <div className="px-2 pb-2 pt-1 border-t border-gray-100">
          <div className="flex items-center gap-1.5 mb-1">
            <Film size={11} className="text-purple-500" />
            <span className="text-[10px] font-semibold text-gray-600 uppercase">Видео слайда · язык</span>
          </div>
          {effectiveLocale ? (
            <div className="flex items-center gap-1">
              <input
                value={slideVideoLoc}
                onChange={(e) =>
                  dispatch(updateTranslationLocally({ nodeId: node.id, field: 'data-slide-video', value: e.target.value }))
                }
                onBlur={(e) => setSlideVideoTranslation(e.target.value.trim())}
                placeholder={`как базовое (${slideVideoBase.split('/').pop()})`}
                className="flex-1 min-w-0 px-2 py-1 text-[11px] border border-gray-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={() => setVideoPickerOpen(true)}
                title="Выбрать из медиатеки"
                className="shrink-0 p-1 rounded border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300"
              >
                <ImageIcon size={12} />
              </button>
              {slideVideoLoc && (
                <button
                  type="button"
                  onClick={() => setSlideVideoTranslation('')}
                  title="Убрать языковой вариант"
                  className="shrink-0 p-1 rounded text-gray-300 hover:text-red-500"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-gray-400">
              {localeEnabled ? 'Выберите язык выше, чтобы задать вариант видео.' : 'Языковые варианты доступны в редакторе страницы.'}
            </p>
          )}
        </div>
      )}

      <MediaPicker
        open={videoPickerOpen}
        kind="video"
        siteId={siteId}
        title="Видео слайда для выбранного языка"
        onClose={() => setVideoPickerOpen(false)}
        onSelect={(asset) => {
          setSlideVideoTranslation(asset.url)
          setVideoPickerOpen(false)
        }}
      />
    </div>
  )
}
