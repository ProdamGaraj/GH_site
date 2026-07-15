import React, { useState, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { useParams } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { updateNode, updateNodeStyles, selectViewport } from '@/features/editor/editorSlice'
import { Input } from '@/shared/components/Input'
import { ImageUpload } from './ImageUpload'
import { MediaLanguageSection } from '@/features/media/MediaLanguageSection'
import { resolveMediaUrl, type MediaAsset } from '@/shared/api/mediaApi'
import { LinkSettings } from './LinkSettings'
import { AttributesEditor } from './AttributesEditor'
import { Link as LinkIcon, Image as ImageIcon, Code as CodeIcon } from 'lucide-react'
import type { BlockNode } from '@/shared/types'

interface ContentTabProps {
  node: BlockNode
}

export const ContentTab: React.FC<ContentTabProps> = ({ node }) => {
  const dispatch = useAppDispatch()
  const viewport = useAppSelector(selectViewport)
  const { id: pageId } = useParams<{ id: string }>()

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

  // Булевы атрибуты (controls/autoplay/loop/muted/playsinline): в HTML само
  // присутствие атрибута = «вкл», поэтому «выкл» — это УДАЛЕНИЕ ключа, а не
  // пустая строка (controls="" включал контролы на деплое). extra — атрибуты,
  // которые надо выставить вместе (autoplay требует muted+playsinline).
  const handleBooleanAttributeChange = (attr: string, on: boolean, extra?: Record<string, string>) => {
    const attributes = { ...(node.attributes || {}) }
    if (on) {
      attributes[attr] = 'true'
    } else {
      delete attributes[attr]
    }
    Object.assign(attributes, extra || {})
    dispatch(updateNode({
      id: node.id,
      updates: { attributes },
    }))
  }

  // Присутствие атрибута со значением, отличным от 'false', = включено
  // ('' — легаси/импорт голого атрибута; семантика совпадает с деплоем).
  const isBooleanAttributeOn = (attr: string): boolean => {
    const value = node.attributes?.[attr]
    return value !== undefined && value !== 'false'
  }

  // Видео из медиатеки: src + постер пишем одним updateNode (два последовательных
  // dispatch'а потеряли бы src — второй спредит устаревшие node.attributes).
  // Постер ассета берём только если свой ещё не задан.
  const handleVideoAssetSelect = (asset: MediaAsset) => {
    const attributes = { ...(node.attributes || {}) }
    attributes.src = resolveMediaUrl(asset.url)
    if (asset.posterUrl && !attributes.poster) {
      attributes.poster = resolveMediaUrl(asset.posterUrl)
    }
    dispatch(updateNode({ id: node.id, updates: { attributes } }))
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
  // Узел с медиа: для него показываем «Языки и экраны» (варианты медиа по
  // языкам/брейкпоинтам) прямо здесь — рядом с выбором исходного файла.
  const isMediaNode =
    isImageElement ||
    isVideoElement ||
    node.elementType === 'image' ||
    !!node.styles?.properties?.backgroundImage ||
    !!node.attributes?.['data-slide-video']

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
          <LinkSettings node={node} pageId={pageId} />
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
          
          {isVideoElement ? (
            // Видео: URL / загрузка файла / выбор из медиатеки. При выборе
            // ассета постер подхватывается автоматически (handleVideoAssetSelect).
            <ImageUpload
              value={node.attributes?.src || ''}
              onChange={(url) => handleAttributeChange('src', url)}
              onSelectAsset={handleVideoAssetSelect}
              label="Видео (src)"
              placeholder="https://example.com/video.mp4"
              kind="video"
            />
          ) : (
            <Input
              label="URL (src)"
              value={node.attributes?.src || ''}
              onChange={(e) => handleAttributeChange('src', e.target.value)}
              placeholder="https://example.com"
            />
          )}
          
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
              <ImageUpload
                value={node.attributes?.poster || ''}
                onChange={(url) => handleAttributeChange('poster', url)}
                label="Постер (превью до запуска)"
                placeholder="https://example.com/poster.jpg"
                kind="image"
              />

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="video-controls"
                  checked={isBooleanAttributeOn('controls')}
                  onChange={(e) => handleBooleanAttributeChange('controls', e.target.checked)}
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
                  checked={isBooleanAttributeOn('autoplay')}
                  onChange={(e) =>
                    // Автозапуск без muted браузеры блокируют, iOS требует playsinline —
                    // включаем их вместе, иначе «видео не играет».
                    handleBooleanAttributeChange(
                      'autoplay',
                      e.target.checked,
                      e.target.checked ? { muted: 'true', playsinline: 'true' } : undefined
                    )
                  }
                  className="rounded border-gray-300"
                />
                <label htmlFor="video-autoplay" className="text-xs text-gray-600">
                  Автозапуск (включит «Без звука»)
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="video-loop"
                  checked={isBooleanAttributeOn('loop')}
                  onChange={(e) => handleBooleanAttributeChange('loop', e.target.checked)}
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
                  checked={isBooleanAttributeOn('muted')}
                  onChange={(e) => handleBooleanAttributeChange('muted', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="video-muted" className="text-xs text-gray-600">
                  Без звука
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="video-playsinline"
                  checked={isBooleanAttributeOn('playsinline')}
                  onChange={(e) => handleBooleanAttributeChange('playsinline', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="video-playsinline" className="text-xs text-gray-600">
                  В контейнере (playsinline, нужно для iPhone)
                </label>
              </div>

              {isBooleanAttributeOn('autoplay') && !isBooleanAttributeOn('muted') && (
                <p className="text-xs text-amber-600">
                  Автозапуск без «Без звука» будет заблокирован браузером.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Медиа по языкам и экранам — здесь же, где выбирается исходный файл */}
      {isMediaNode && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-700">Языки и экраны</h4>
          <MediaLanguageSection node={node} pageId={pageId} />
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

        <AttributesEditor node={node} />
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
