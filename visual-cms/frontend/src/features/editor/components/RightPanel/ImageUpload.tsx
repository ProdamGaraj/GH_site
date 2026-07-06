import React, { useRef, useState, useCallback } from 'react'
import { Upload, X, Image as ImageIcon, Link as LinkIcon, Loader2, FolderOpen } from 'lucide-react'
import { mediaApi, resolveMediaUrl, type MediaAsset } from '@/shared/api/mediaApi'
import { MediaPicker } from '@/features/media/MediaPicker'
import { useProjectVariantWidths } from '@/features/media/useProjectVariantWidths'

interface ImageUploadProps {
  value: string
  onChange: (url: string) => void
  label?: string
  placeholder?: string
  /** Restrict media kind. Default 'image'. */
  kind?: 'image' | 'video' | 'any'
  /**
   * Если задан — при выборе из галереи/загрузке файла вызывается ВМЕСТО
   * onChange с полным asset'ом (нужно, когда потребитель пишет несколько
   * атрибутов атомарно: например src + poster у видео). Ручной ввод URL
   * по-прежнему идёт через onChange.
   */
  onSelectAsset?: (asset: MediaAsset) => void
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  label = 'Изображение',
  placeholder = 'https://example.com/image.jpg',
  kind = 'image',
  onSelectAsset,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUrlMode, setIsUrlMode] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [optimize, setOptimize] = useState(true)
  const [makeResponsive, setMakeResponsive] = useState(true)
  const variantWidths = useProjectVariantWidths()
  const showImageOptions = kind === 'image' || kind === 'any'

  const handleFileSelect = useCallback(async (file: File) => {
    const expectImage = kind === 'image'
    const expectVideo = kind === 'video'
    if (expectImage && !file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение')
      return
    }
    if (expectVideo && !file.type.startsWith('video/')) {
      alert('Пожалуйста, выберите видео')
      return
    }

    setIsUploading(true)
    setPreviewError(false)

    // Опции оптимизации/адаптивов применимы только к изображениям; бэкенд игнорирует их для прочего.
    const isImage = file.type.startsWith('image/')

    try {
      const asset = await mediaApi.upload({
        file,
        title: file.name.replace(/\.[^.]+$/, ''),
        optimize: isImage && showImageOptions ? optimize : false,
        variantWidths: isImage && showImageOptions && makeResponsive ? variantWidths : undefined,
      })
      // Если создана оптимизированная версия — подставляем её (легче, без потери качества).
      if (onSelectAsset) {
        onSelectAsset(asset)
      } else {
        onChange(resolveMediaUrl(asset.optimizedUrl || asset.url))
      }
    } catch (error: any) {
      console.error('Upload error:', error)
      alert(`Ошибка загрузки: ${error?.message || ''}`)
    } finally {
      setIsUploading(false)
    }
  }, [onChange, onSelectAsset, kind, showImageOptions, optimize, makeResponsive, variantWidths])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      handleFileSelect(files[0])
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files[0]) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleClear = () => {
    onChange('')
    setPreviewError(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-xs font-medium text-gray-700 block">{label}</label>
      )}
      
      {/* Mode toggle */}
      <div className="flex border border-gray-300 rounded overflow-hidden">
        <button
          type="button"
          onClick={() => setIsUrlMode(true)}
          className={`flex-1 px-2 py-1 text-xs flex items-center justify-center gap-1 ${
            isUrlMode ? 'bg-primary-100 text-primary-700' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <LinkIcon size={12} /> URL
        </button>
        <button
          type="button"
          onClick={() => setIsUrlMode(false)}
          className={`flex-1 px-2 py-1 text-xs flex items-center justify-center gap-1 ${
            !isUrlMode ? 'bg-primary-100 text-primary-700' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Upload size={12} /> Загрузить
        </button>
      </div>

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="w-full px-2 py-1.5 text-xs flex items-center justify-center gap-1 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50"
      >
        <FolderOpen size={12} /> Выбрать из галереи
      </button>

      {isUrlMode ? (
        // URL input mode
        <div className="relative">
          <input
            type="url"
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              setPreviewError(false)
            }}
            placeholder={placeholder}
            className="w-full px-3 py-1.5 pr-8 border border-gray-300 rounded text-sm text-gray-900 bg-white"
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        // File upload mode
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            dragActive
              ? 'border-primary-400 bg-primary-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={kind === 'image' ? 'image/*' : kind === 'video' ? 'video/*' : 'image/*,video/*'}
            onChange={handleInputChange}
            className="hidden"
          />
          
          {isUploading ? (
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <Loader2 size={24} className="animate-spin" />
              <span className="text-xs">Загрузка...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <Upload size={24} />
              <span className="text-xs">
                Перетащите изображение или кликните для выбора
              </span>
              <span className="text-[10px] text-gray-400">
                {kind === 'video' ? 'MP4, WebM до 200MB' : kind === 'any' ? 'JPG/PNG/WebP/GIF/SVG до 10MB, MP4/WebM до 200MB' : 'JPG, PNG, GIF, WebP, SVG до 10MB'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Опции оптимизации/адаптивов (для изображений; применяются при загрузке файла) */}
      {showImageOptions && (
        <div className="flex flex-col gap-1 text-[11px] text-gray-600 border-t border-gray-100 pt-2">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={optimize} onChange={(e) => setOptimize(e.target.checked)} />
            Оптимизировать (без потери качества)
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={makeResponsive}
              onChange={(e) => setMakeResponsive(e.target.checked)}
            />
            Адаптивные размеры{variantWidths.length > 0 ? ` (${variantWidths.length})` : ''}
          </label>
        </div>
      )}

      {/* Preview: <img> для картинок, <video> для видео */}
      {value && !previewError && (
        <div className="relative border border-gray-200 rounded overflow-hidden bg-gray-50">
          {kind === 'video' ? (
            <video
              src={value}
              controls
              muted
              playsInline
              preload="metadata"
              className="w-full max-h-32 object-contain"
              onError={() => setPreviewError(true)}
            />
          ) : (
            <img
              src={value}
              alt="Preview"
              className="w-full max-h-32 object-contain"
              onError={() => setPreviewError(true)}
            />
          )}
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-1 right-1 p-1 bg-white/80 rounded shadow hover:bg-white"
          >
            <X size={14} className="text-gray-600" />
          </button>
        </div>
      )}

      {previewError && value && (
        <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
          <ImageIcon size={14} />
          <span>{kind === 'video' ? 'Не удалось загрузить видео' : 'Не удалось загрузить изображение'}</span>
        </div>
      )}

      <MediaPicker
        open={pickerOpen}
        kind={kind}
        onClose={() => setPickerOpen(false)}
        onSelect={(asset) => {
          if (onSelectAsset) {
            onSelectAsset(asset)
          } else {
            onChange(resolveMediaUrl(asset.url))
          }
          setPreviewError(false)
        }}
      />
    </div>
  )
}
