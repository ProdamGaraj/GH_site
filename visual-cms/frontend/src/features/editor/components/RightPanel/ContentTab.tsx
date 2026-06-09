import React, { useState, useCallback, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { useParams } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { updateNode, updateNodeStyles, selectViewport } from '@/features/editor/editorSlice'
import { Input } from '@/shared/components/Input'
import { ImageUpload } from './ImageUpload'
import { MediaPicker } from '@/features/media/MediaPicker'
import { resolveMediaUrl } from '@/shared/api/mediaApi'
import { Link as LinkIcon, Image as ImageIcon, Code as CodeIcon, FileText } from 'lucide-react'
import type { BlockNode, Page } from '@/shared/types'
import { pageApi } from '@/shared/api'

interface ContentTabProps {
  node: BlockNode
}

export const ContentTab: React.FC<ContentTabProps> = ({ node }) => {
  const dispatch = useAppDispatch()
  const viewport = useAppSelector(selectViewport)
  const { id: pageId } = useParams<{ id: string }>()
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

  const handleContentChange = (content: string) => {
    dispatch(updateNode({
      id: node.id,
      updates: { content },
    }))
  }

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

  const handleStyleChange = (property: string, value: string) => {
    dispatch(updateNodeStyles({
      nodeId: node.id,
      properties: { [property]: value },
      breakpoint: viewport,
    }))
  }

  // Element type checks
  const isTextElement = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'label'].includes(node.tagName || '')
  const isLinkElement = node.tagName === 'a'
  const isImageElement = node.tagName === 'img'
  const isInputElement = ['input', 'textarea', 'select'].includes(node.tagName || '')
  const isButtonElement = node.tagName === 'button'
  const isVideoElement = node.tagName === 'video'
  const isIframeElement = node.tagName === 'iframe'
  const isHtmlCodeElement = node.elementType === 'html-code'

  // Local state for HTML code editor with debounced save
  const [htmlCode, setHtmlCode] = useState(node.content || '')
  const [isHtmlDirty, setIsHtmlDirty] = useState(false)

  // Sync from node when content changes externally
  React.useEffect(() => {
    if (!isHtmlDirty) {
      setHtmlCode(node.content || '')
    }
  }, [node.content, isHtmlDirty])

  const handleHtmlCodeChange = useCallback((value: string | undefined) => {
    const code = value || ''
    setHtmlCode(code)
    setIsHtmlDirty(true)
  }, [])

  const applyHtmlCode = useCallback(() => {
    dispatch(updateNode({
      id: node.id,
      updates: { content: htmlCode },
    }))
    setIsHtmlDirty(false)
  }, [dispatch, node.id, htmlCode])
  
  return (
    <div className="space-y-4">
      {/* HTML Code Editor */}
      {isHtmlCodeElement && (
        <div>
          <h4 className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-2">
            <CodeIcon size={14} /> HTML код
          </h4>
          <p className="text-xs text-gray-500 mb-2">
            Вставьте произвольный HTML код. Он будет отображён на странице как есть.
          </p>
          <div className="border border-gray-300 rounded overflow-hidden">
            <Editor
              height="300px"
              language="html"
              theme="vs-dark"
              value={htmlCode}
              onChange={handleHtmlCodeChange}
              options={{
                minimap: { enabled: false },
                lineNumbers: 'on',
                fontSize: 12,
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                tabSize: 2,
                formatOnPaste: true,
              }}
            />
          </div>
          {isHtmlDirty && (
            <button
              onClick={applyHtmlCode}
              className="mt-2 w-full px-3 py-2 bg-violet-600 text-white text-xs font-medium rounded hover:bg-violet-700 transition-colors"
            >
              Применить HTML
            </button>
          )}
        </div>
      )}

      {/* Content for text elements */}
      {isTextElement && (
        <div>
          <label className="text-xs font-medium text-gray-700 mb-2 block">Текст</label>
          <textarea
            value={node.content || ''}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Введите текст..."
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 min-h-[80px] bg-white"
          />
        </div>
      )}

      {/* Link attributes */}
      {isLinkElement && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-700 flex items-center gap-1">
            <LinkIcon size={14} /> Ссылка
          </h4>

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
      )}

      {/* Image attributes */}
      {isImageElement && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-700 flex items-center gap-1">
            <ImageIcon size={14} /> Изображение
          </h4>
          
          <ImageUpload
            value={node.attributes?.src || ''}
            onChange={(url) => handleAttributeChange('src', url)}
            label="Источник изображения"
          />
          
          <Input
            label="Alt текст"
            value={node.attributes?.alt || ''}
            onChange={(e) => handleAttributeChange('alt', e.target.value)}
            placeholder="Описание изображения"
          />
          
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Width"
              value={node.attributes?.width || ''}
              onChange={(e) => handleAttributeChange('width', e.target.value)}
              placeholder="auto"
            />
            <Input
              label="Height"
              value={node.attributes?.height || ''}
              onChange={(e) => handleAttributeChange('height', e.target.value)}
              placeholder="auto"
            />
          </div>
          
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Object Fit</label>
            <select
              value={node.styles.properties?.objectFit || ''}
              onChange={(e) => handleStyleChange('objectFit', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded text-sm text-gray-900"
            >
              <option value="">По умолчанию</option>
              <option value="contain">Contain</option>
              <option value="cover">Cover</option>
              <option value="fill">Fill</option>
              <option value="none">None</option>
              <option value="scale-down">Scale Down</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="img-loading"
              checked={node.attributes?.loading === 'lazy'}
              onChange={(e) => handleAttributeChange('loading', e.target.checked ? 'lazy' : 'eager')}
              className="rounded border-gray-300"
            />
            <label htmlFor="img-loading" className="text-xs text-gray-600">
              Ленивая загрузка (lazy loading)
            </label>
          </div>
        </div>
      )}

      {/* Input element attributes */}
      {isInputElement && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-700">Поле ввода</h4>
          
          {node.tagName === 'input' && (
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Тип</label>
              <select
                value={node.attributes?.type || 'text'}
                onChange={(e) => handleAttributeChange('type', e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded text-sm text-gray-900"
              >
                <option value="text">Текст</option>
                <option value="email">Email</option>
                <option value="password">Пароль</option>
                <option value="number">Число</option>
                <option value="tel">Телефон</option>
                <option value="url">URL</option>
                <option value="date">Дата</option>
                <option value="time">Время</option>
                <option value="search">Поиск</option>
                <option value="checkbox">Чекбокс</option>
                <option value="radio">Радио</option>
                <option value="file">Файл</option>
                <option value="hidden">Скрытое</option>
              </select>
            </div>
          )}
          
          <Input
            label="Placeholder"
            value={node.attributes?.placeholder || ''}
            onChange={(e) => handleAttributeChange('placeholder', e.target.value)}
            placeholder="Текст подсказки"
          />
          
          <Input
            label="Name (имя поля)"
            value={node.attributes?.name || ''}
            onChange={(e) => handleAttributeChange('name', e.target.value)}
            placeholder="field_name"
          />
          
          <Input
            label="Value (значение)"
            value={node.attributes?.value || ''}
            onChange={(e) => handleAttributeChange('value', e.target.value)}
            placeholder=""
          />
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="input-required"
                checked={node.attributes?.required === 'true'}
                onChange={(e) => handleAttributeChange('required', e.target.checked ? 'true' : '')}
                className="rounded border-gray-300"
              />
              <label htmlFor="input-required" className="text-xs text-gray-600">
                Обязательное поле
              </label>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="input-disabled"
                checked={node.attributes?.disabled === 'true'}
                onChange={(e) => handleAttributeChange('disabled', e.target.checked ? 'true' : '')}
                className="rounded border-gray-300"
              />
              <label htmlFor="input-disabled" className="text-xs text-gray-600">
                Отключено
              </label>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="input-readonly"
                checked={node.attributes?.readonly === 'true'}
                onChange={(e) => handleAttributeChange('readonly', e.target.checked ? 'true' : '')}
                className="rounded border-gray-300"
              />
              <label htmlFor="input-readonly" className="text-xs text-gray-600">
                Только чтение
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Button attributes */}
      {isButtonElement && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-700">Кнопка</h4>
          
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Тип</label>
            <select
              value={node.attributes?.type || 'button'}
              onChange={(e) => handleAttributeChange('type', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded text-sm text-gray-900"
            >
              <option value="button">Button</option>
              <option value="submit">Submit</option>
              <option value="reset">Reset</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="btn-disabled"
              checked={node.attributes?.disabled === 'true'}
              onChange={(e) => handleAttributeChange('disabled', e.target.checked ? 'true' : '')}
              className="rounded border-gray-300"
            />
            <label htmlFor="btn-disabled" className="text-xs text-gray-600">
              Отключена
            </label>
          </div>
        </div>
      )}

      {/* Video/Iframe attributes */}
      {(isVideoElement || isIframeElement) && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-700">
            {isVideoElement ? 'Видео' : 'Iframe'}
          </h4>
          
          <Input
            label="URL (src)"
            value={node.attributes?.src || ''}
            onChange={(e) => handleAttributeChange('src', e.target.value)}
            placeholder={isVideoElement ? 'https://example.com/video.mp4' : 'https://example.com'}
          />
          
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Width"
              value={node.attributes?.width || ''}
              onChange={(e) => handleAttributeChange('width', e.target.value)}
              placeholder="100%"
            />
            <Input
              label="Height"
              value={node.attributes?.height || ''}
              onChange={(e) => handleAttributeChange('height', e.target.value)}
              placeholder="auto"
            />
          </div>
          
          {isVideoElement && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="video-controls"
                  checked={node.attributes?.controls === 'true'}
                  onChange={(e) => handleAttributeChange('controls', e.target.checked ? 'true' : '')}
                  className="rounded border-gray-300"
                />
                <label htmlFor="video-controls" className="text-xs text-gray-600">
                  Показать контролы
                </label>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="video-autoplay"
                  checked={node.attributes?.autoplay === 'true'}
                  onChange={(e) => handleAttributeChange('autoplay', e.target.checked ? 'true' : '')}
                  className="rounded border-gray-300"
                />
                <label htmlFor="video-autoplay" className="text-xs text-gray-600">
                  Автозапуск
                </label>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="video-loop"
                  checked={node.attributes?.loop === 'true'}
                  onChange={(e) => handleAttributeChange('loop', e.target.checked ? 'true' : '')}
                  className="rounded border-gray-300"
                />
                <label htmlFor="video-loop" className="text-xs text-gray-600">
                  Зациклить
                </label>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="video-muted"
                  checked={node.attributes?.muted === 'true'}
                  onChange={(e) => handleAttributeChange('muted', e.target.checked ? 'true' : '')}
                  className="rounded border-gray-300"
                />
                <label htmlFor="video-muted" className="text-xs text-gray-600">
                  Без звука
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Common ID/Class attributes */}
      <div className="space-y-3 pt-2 border-t border-gray-100">
        <h4 className="text-xs font-medium text-gray-700">HTML атрибуты</h4>
        
        <Input
          label="ID"
          value={node.attributes?.id || ''}
          onChange={(e) => handleAttributeChange('id', e.target.value)}
          placeholder="element-id"
        />
        
        <Input
          label="Class"
          value={node.attributes?.class || ''}
          onChange={(e) => handleAttributeChange('class', e.target.value)}
          placeholder="class1 class2"
        />
        
        <Input
          label="Title (подсказка)"
          value={node.attributes?.title || ''}
          onChange={(e) => handleAttributeChange('title', e.target.value)}
          placeholder="Текст при наведении"
        />
      </div>

      {/* Typography */}
      {isTextElement && (
        <div className="pt-2 border-t border-gray-100">
          <h4 className="text-xs font-medium text-gray-700 mb-2">Типографика</h4>
          <div className="space-y-2">
            <Input
              label="Font Family"
              value={node.styles.properties?.fontFamily || ''}
              onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
              placeholder="inherit"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Font Size"
                value={node.styles.properties?.fontSize || ''}
                onChange={(e) => handleStyleChange('fontSize', e.target.value)}
                placeholder="16px"
              />
              <Input
                label="Font Weight"
                value={node.styles.properties?.fontWeight || ''}
                onChange={(e) => handleStyleChange('fontWeight', e.target.value)}
                placeholder="400"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Line Height"
                value={node.styles.properties?.lineHeight || ''}
                onChange={(e) => handleStyleChange('lineHeight', e.target.value)}
                placeholder="1.5"
              />
              <Input
                label="Letter Spacing"
                value={node.styles.properties?.letterSpacing || ''}
                onChange={(e) => handleStyleChange('letterSpacing', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          
          {/* Text Align */}
          <div className="mt-3">
            <label className="text-xs font-medium text-gray-700 mb-2 block">Выравнивание</label>
            <div className="flex gap-2">
              {['left', 'center', 'right', 'justify'].map((align) => (
                <button
                  key={align}
                  onClick={() => handleStyleChange('textAlign', align)}
                  className={`flex-1 px-3 py-2 text-xs border rounded text-gray-700 ${
                    node.styles.properties?.textAlign === align
                      ? 'bg-primary-100 border-primary-300'
                      : 'bg-white border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {align}
                </button>
              ))}
            </div>
          </div>
          
          {/* Text Decoration */}
          <div className="mt-3">
            <label className="text-xs font-medium text-gray-700 mb-2 block">Декорация</label>
            <div className="flex gap-2">
              {['none', 'underline', 'line-through'].map((decoration) => (
                <button
                  key={decoration}
                  onClick={() => handleStyleChange('textDecoration', decoration)}
                  className={`flex-1 px-3 py-2 text-xs border rounded text-gray-700 ${
                    node.styles.properties?.textDecoration === decoration
                      ? 'bg-primary-100 border-primary-300'
                      : 'bg-white border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {decoration}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
