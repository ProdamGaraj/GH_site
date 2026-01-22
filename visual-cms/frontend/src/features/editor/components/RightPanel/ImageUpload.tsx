import React, { useRef, useState, useCallback } from 'react'
import { Upload, X, Image as ImageIcon, Link as LinkIcon, Loader2 } from 'lucide-react'

interface ImageUploadProps {
  value: string
  onChange: (url: string) => void
  label?: string
  placeholder?: string
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  label = 'Изображение',
  placeholder = 'https://example.com/image.jpg'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUrlMode, setIsUrlMode] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение')
      return
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert('Максимальный размер файла: 5MB')
      return
    }

    setIsUploading(true)
    setPreviewError(false)

    try {
      // For now, convert to base64 data URL
      // In production, this would upload to MinIO/S3
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        onChange(dataUrl)
        setIsUploading(false)
      }
      reader.onerror = () => {
        alert('Ошибка чтения файла')
        setIsUploading(false)
      }
      reader.readAsDataURL(file)

      // TODO: Upload to MinIO backend
      // const formData = new FormData()
      // formData.append('file', file)
      // const response = await fetch('/api/upload', { method: 'POST', body: formData })
      // const { url } = await response.json()
      // onChange(url)
    } catch (error) {
      console.error('Upload error:', error)
      alert('Ошибка загрузки файла')
      setIsUploading(false)
    }
  }, [onChange])

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
            accept="image/*"
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
                JPG, PNG, GIF, WebP до 5MB
              </span>
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {value && !previewError && (
        <div className="relative border border-gray-200 rounded overflow-hidden bg-gray-50">
          <img
            src={value}
            alt="Preview"
            className="w-full max-h-32 object-contain"
            onError={() => setPreviewError(true)}
          />
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
          <span>Не удалось загрузить изображение</span>
        </div>
      )}
    </div>
  )
}
