import React, { useState, useEffect } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { updateNode } from '@/features/editor/editorSlice'
import { Input } from '@/shared/components/Input'
import { MediaPicker } from '@/features/media/MediaPicker'
import { resolveMediaUrl } from '@/shared/api/mediaApi'
import { FileText } from 'lucide-react'
import type { BlockNode, Page } from '@/shared/types'
import { pageApi } from '@/shared/api'

interface LinkSettingsProps {
  node: BlockNode
  /** ID страницы — нужен для выбора страниц сайта; в редакторе блоков отсутствует */
  pageId?: string
}

/**
 * Поля настройки ссылки (страница сайта / URL / документ / target / title / rel).
 * Используется для инлайн-ссылок (ContentTab) и блоков-ссылок (BasicSettingsPanel).
 */
export const LinkSettings: React.FC<LinkSettingsProps> = ({ node, pageId }) => {
  const dispatch = useAppDispatch()
  const [sitePages, setSitePages] = useState<Page[]>([])
  const [docPickerOpen, setDocPickerOpen] = useState(false)

  // Load sibling pages for the page link picker
  useEffect(() => {
    if (!pageId) return
    let cancelled = false
    pageApi.getById(pageId).then(page => {
      if (cancelled || !page.siteId) return
      pageApi.getAll(page.siteId).then(pages => {
        if (!cancelled) setSitePages(pages)
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [pageId])

  const handleAttributeChange = (attr: string, value: string) => {
    dispatch(updateNode({
      id: node.id,
      updates: {
        attributes: {
          ...node.attributes,
          [attr]: value,
        },
      },
    }))
  }

  return (
    <div className="space-y-3">
      {/* Page link picker */}
      {sitePages.length > 0 && (
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Страница сайта</label>
          <select
            value={node.attributes?.['data-page-id'] || ''}
            onChange={(e) => {
              const selectedPageId = e.target.value
              if (selectedPageId) {
                const page = sitePages.find(p => p.id === selectedPageId)
                if (page) {
                  const href = page.slug === 'home' || page.slug === 'index' ? '/' : `/${page.slug}`
                  handleAttributeChange('href', href)
                  handleAttributeChange('data-page-id', selectedPageId)
                }
              } else {
                handleAttributeChange('data-page-id', '')
              }
            }}
            className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded text-sm text-gray-900"
          >
            <option value="">— Внешняя ссылка —</option>
            {sitePages.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} (/{p.slug})
              </option>
            ))}
          </select>
        </div>
      )}

      <Input
        label="URL (href)"
        value={node.attributes?.href || ''}
        onChange={(e) => handleAttributeChange('href', e.target.value)}
        placeholder="https://example.com"
      />
      <button
        type="button"
        onClick={() => setDocPickerOpen(true)}
        className="w-full px-2 py-1.5 text-xs flex items-center justify-center gap-1 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50"
      >
        <FileText size={12} /> Выбрать документ
      </button>
      <MediaPicker
        open={docPickerOpen}
        kind="document"
        onClose={() => setDocPickerOpen(false)}
        onSelect={(asset) => {
          handleAttributeChange('href', resolveMediaUrl(asset.url))
          handleAttributeChange('data-page-id', '')
        }}
      />
      <div>
        <label className="text-xs text-gray-600 mb-1 block">Открывать в</label>
        <select
          value={node.attributes?.target || ''}
          onChange={(e) => handleAttributeChange('target', e.target.value)}
          className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded text-sm text-gray-900"
        >
          <option value="">Текущее окно</option>
          <option value="_blank">Новая вкладка</option>
          <option value="_parent">Родительский фрейм</option>
          <option value="_top">Полное окно</option>
        </select>
      </div>
      <Input
        label="Title (подсказка)"
        value={node.attributes?.title || ''}
        onChange={(e) => handleAttributeChange('title', e.target.value)}
        placeholder="Подсказка при наведении"
      />
      <div>
        <label className="text-xs text-gray-600 mb-1 block">Rel атрибут</label>
        <select
          value={node.attributes?.rel || ''}
          onChange={(e) => handleAttributeChange('rel', e.target.value)}
          className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded text-sm text-gray-900"
        >
          <option value="">Не указан</option>
          <option value="noopener">noopener</option>
          <option value="noreferrer">noreferrer</option>
          <option value="nofollow">nofollow</option>
          <option value="noopener noreferrer">noopener noreferrer</option>
        </select>
      </div>
    </div>
  )
}
