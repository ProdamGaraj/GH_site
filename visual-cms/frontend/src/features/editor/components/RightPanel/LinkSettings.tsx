import React, { useState, useEffect, useMemo } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { updateNode } from '@/features/editor/editorSlice'
import { Input } from '@/shared/components/Input'
import { MediaPicker } from '@/features/media/MediaPicker'
import { resolveMediaUrl } from '@/shared/api/mediaApi'
import { FileText } from 'lucide-react'
import type { BlockNode, Page, Site } from '@/shared/types'
import { pageApi, siteApi } from '@/shared/api'

interface LinkSettingsProps {
  node: BlockNode
  /** ID страницы — сужает пикер до страниц её сайта; в редакторе блоков отсутствует */
  pageId?: string
}

/**
 * Внутренний относительный href ("contacts", "./news") на деплое ломается:
 * страницы живут в директориях /<slug>/, браузер резолвит его как /<slug>/contacts.
 * Приводим к корневому виду. Абсолютные URL (scheme:, //), корневые (/),
 * якоря (#) и query (?) не трогаем.
 */
export function normalizeInternalHref(href: string): string {
  const trimmed = href.trim()
  if (!trimmed) return trimmed
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#|\?)/i.test(trimmed)) return trimmed
  return '/' + trimmed.replace(/^(?:\.\.?\/)+/, '')
}

/**
 * Поля настройки ссылки (страница сайта / URL / документ / target / title / rel).
 * Используется для инлайн-ссылок (ContentTab) и блоков-ссылок (BasicSettingsPanel).
 */
export const LinkSettings: React.FC<LinkSettingsProps> = ({ node, pageId }) => {
  const dispatch = useAppDispatch()
  const [sitePages, setSitePages] = useState<Page[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [docPickerOpen, setDocPickerOpen] = useState(false)

  // Пикер страниц. С pageId (редактор страницы) — страницы её сайта.
  // Без pageId или если id не страница (редактор блоков: в useParams лежит id
  // блока) — фолбэк: страницы ВСЕХ сайтов, сгруппированные по сайту. Раньше
  // фолбэка не было, и в редакторе блоков пикер просто отсутствовал.
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (pageId) {
        try {
          const page = await pageApi.getById(pageId)
          if (page.siteId) {
            const pages = await pageApi.getAll(page.siteId)
            if (!cancelled) setSitePages(pages)
            return
          }
        } catch {
          // pageId не является страницей (редактор блоков) — идём в фолбэк
        }
      }
      try {
        const [pages, allSites] = await Promise.all([pageApi.getAll(), siteApi.getAll()])
        if (!cancelled) {
          setSitePages(pages)
          setSites(allSites)
        }
      } catch {
        // API недоступен — пикер просто не показываем
      }
    }

    load()
    return () => { cancelled = true }
  }, [pageId])

  // Группировка страниц по сайтам для фолбэка (несколько сайтов → optgroup)
  const pageGroups = useMemo(() => {
    if (sites.length === 0) return null
    const bySite = new Map<string, Page[]>()
    for (const page of sitePages) {
      const key = page.siteId || ''
      if (!bySite.has(key)) bySite.set(key, [])
      bySite.get(key)!.push(page)
    }
    if (bySite.size <= 1) return null
    const siteName = (id: string) => sites.find(s => s.id === id)?.name || 'Без сайта'
    return [...bySite.entries()].map(([siteId, pages]) => ({ label: siteName(siteId), pages }))
  }, [sitePages, sites])

  // Все атрибуты пишутся одним dispatch: два последовательных вызова с одним
  // атрибутом затирали бы друг друга — оба читают устаревший node.attributes из замыкания.
  const setAttributes = (updates: Record<string, string>) => {
    dispatch(updateNode({
      id: node.id,
      updates: {
        attributes: {
          ...node.attributes,
          ...updates,
        },
      },
    }))
  }

  const handleAttributeChange = (attr: string, value: string) => {
    setAttributes({ [attr]: value })
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
                  setAttributes({ href, 'data-page-id': selectedPageId })
                }
              } else {
                setAttributes({ 'data-page-id': '' })
              }
            }}
            className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded text-sm text-gray-900"
          >
            <option value="">— Внешняя ссылка —</option>
            {pageGroups
              ? pageGroups.map(group => (
                  <optgroup key={group.label} label={group.label}>
                    {group.pages.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (/{p.slug})
                      </option>
                    ))}
                  </optgroup>
                ))
              : sitePages.map(p => (
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
        onBlur={(e) => {
          // «contacts» → «/contacts»: относительный href на деплое уехал бы
          // под текущую страницу (/about/contacts). Нормализуем по окончании ввода.
          const normalized = normalizeInternalHref(e.target.value)
          if (normalized !== e.target.value) handleAttributeChange('href', normalized)
        }}
        placeholder="https://example.com или /slug"
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
          setAttributes({ href: resolveMediaUrl(asset.url), 'data-page-id': '' })
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
