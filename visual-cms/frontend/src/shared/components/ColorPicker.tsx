import React, { useRef, useCallback, useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/shared/utils'

type ColorFormat = 'hex' | 'rgb' | 'rgba' | 'hsl' | 'hsla'

interface ColorPickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  // Для live preview на canvas - id элемента и CSS свойство
  previewElementId?: string
  previewProperty?: string
}

// Парсинг любого CSS цвета в RGBA
const parseColor = (color: string): { r: number; g: number; b: number; a: number } | null => {
  if (!color) return null
  
  // Используем canvas для парсинга любого CSS цвета
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = color
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      return { r, g, b, a: a / 255 }
    }
  } catch {
    // ignore
  }
  
  // Fallback для rgba с альфой
  const rgbaMatch = color.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i)
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]),
      g: parseInt(rgbaMatch[2]),
      b: parseInt(rgbaMatch[3]),
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
    }
  }
  
  return null
}

// Конвертация RGBA в разные форматы
const toHex = (r: number, g: number, b: number): string => {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

const toRgb = (r: number, g: number, b: number): string => `rgb(${r}, ${g}, ${b})`
const toRgba = (r: number, g: number, b: number, a: number): string => `rgba(${r}, ${g}, ${b}, ${a})`

const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

const toHsl = (r: number, g: number, b: number): string => {
  const { h, s, l } = rgbToHsl(r, g, b)
  return `hsl(${h}, ${s}%, ${l}%)`
}

const toHsla = (r: number, g: number, b: number, a: number): string => {
  const { h, s, l } = rgbToHsl(r, g, b)
  return `hsla(${h}, ${s}%, ${l}%, ${a})`
}

// Конвертировать цвет в нужный формат
const convertToFormat = (color: string, format: ColorFormat): string => {
  const parsed = parseColor(color)
  if (!parsed) return color
  const { r, g, b, a } = parsed
  
  switch (format) {
    case 'hex': return toHex(r, g, b)
    case 'rgb': return toRgb(r, g, b)
    case 'rgba': return toRgba(r, g, b, a)
    case 'hsl': return toHsl(r, g, b)
    case 'hsla': return toHsla(r, g, b, a)
    default: return color
  }
}

// Определить формат из строки цвета
const detectFormat = (color: string): ColorFormat => {
  if (!color) return 'hex'
  if (color.startsWith('#')) return 'hex'
  if (color.startsWith('rgba')) return 'rgba'
  if (color.startsWith('rgb')) return 'rgb'
  if (color.startsWith('hsla')) return 'hsla'
  if (color.startsWith('hsl')) return 'hsl'
  return 'hex'
}

// HEX для браузерного пикера
const toHexForPicker = (color: string): string => {
  const parsed = parseColor(color)
  if (parsed) return toHex(parsed.r, parsed.g, parsed.b)
  return '#000000'
}

const FORMAT_LABELS: Record<ColorFormat, string> = {
  'hex': 'HEX',
  'rgb': 'RGB',
  'rgba': 'RGBA',
  'hsl': 'HSL',
  'hsla': 'HSLA'
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  className,
  placeholder = 'Не задано',
  previewElementId,
  previewProperty = 'backgroundColor'
}) => {
  const [format, setFormat] = useState<ColorFormat>(() => detectFormat(value))
  const [showFormatMenu, setShowFormatMenu] = useState(false)
  
  const colorInputRef = useRef<HTMLInputElement>(null)
  const textInputRef = useRef<HTMLInputElement>(null)
  const swatchRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const pendingColorRef = useRef<string | null>(null)

  // Закрыть меню при клике вне
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowFormatMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Обновить превью элемента на canvas напрямую через DOM
  const updateCanvasPreview = useCallback((color: string) => {
    if (!previewElementId) return
    const element = document.querySelector(`[data-element-id="${previewElementId}"]`) as HTMLElement
    if (element) {
      element.style.setProperty(previewProperty.replace(/([A-Z])/g, '-$1').toLowerCase(), color)
    }
  }, [previewElementId, previewProperty])

  // При изменении в пикере - обновляем превью без Redux (HEX во время drag)
  const handlePickerInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const hex = (e.target as HTMLInputElement).value
    pendingColorRef.current = hex
    
    // Обновляем локальные элементы напрямую (без React state)
    if (swatchRef.current) {
      swatchRef.current.style.backgroundColor = hex
    }
    if (textInputRef.current) {
      // Показываем HEX во время drag для производительности
      textInputRef.current.value = hex
    }
    
    // Обновляем элемент на canvas
    updateCanvasPreview(hex)
  }, [updateCanvasPreview])

  // Когда пикер закрылся - конвертируем в нужный формат и сохраняем
  const handlePickerBlur = useCallback(() => {
    if (pendingColorRef.current) {
      // Конвертируем в выбранный формат только при сохранении
      const formatted = convertToFormat(pendingColorRef.current, format)
      if (textInputRef.current) {
        textInputRef.current.value = formatted
      }
      if (formatted !== value) {
        onChange(formatted)
      }
    }
    pendingColorRef.current = null
  }, [value, onChange, format])

  // Смена формата - конвертируем текущее значение
  const handleFormatChange = (newFormat: ColorFormat) => {
    setFormat(newFormat)
    setShowFormatMenu(false)
    
    if (value) {
      const converted = convertToFormat(value, newFormat)
      if (textInputRef.current) {
        textInputRef.current.value = converted
      }
      onChange(converted)
    }
  }

  // Текстовое поле потеряло фокус
  const handleTextBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const newValue = e.target.value.trim()
    if (newValue !== value) {
      onChange(newValue)
      // Определяем формат из введённого значения
      setFormat(detectFormat(newValue))
    }
  }

  // Enter в текстовом поле
  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const newValue = (e.target as HTMLInputElement).value.trim()
      if (newValue !== value) {
        onChange(newValue)
        setFormat(detectFormat(newValue))
      }
      ;(e.target as HTMLInputElement).blur()
    }
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex gap-2">
        {/* Color swatch with picker */}
        <div className="relative">
          <div 
            ref={swatchRef}
            className="w-9 h-9 rounded border border-gray-300 cursor-pointer overflow-hidden"
            style={{ backgroundColor: value || 'transparent' }}
            onClick={() => colorInputRef.current?.click()}
          >
            {!value && (
              <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                <span className="text-gray-400 text-xs">?</span>
              </div>
            )}
          </div>
          <input
            ref={colorInputRef}
            type="color"
            defaultValue={toHexForPicker(value)}
            onInput={handlePickerInput}
            onBlur={handlePickerBlur}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </div>
        
        {/* Text input */}
        <input
          ref={textInputRef}
          type="text"
          defaultValue={value}
          key={value}
          onBlur={handleTextBlur}
          onKeyDown={handleTextKeyDown}
          placeholder={placeholder}
          className="flex-1 px-2 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono"
        />
        
        {/* Format selector */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowFormatMenu(!showFormatMenu)}
            className="px-2 py-1.5 text-xs bg-gray-100 text-gray-700 border border-gray-300 rounded hover:bg-gray-200 transition-colors flex items-center gap-1 min-w-[60px] justify-between"
          >
            {FORMAT_LABELS[format]}
            <ChevronDown size={12} />
          </button>
          
          {showFormatMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
              {(Object.keys(FORMAT_LABELS) as ColorFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => handleFormatChange(f)}
                  className={cn(
                    "w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 transition-colors",
                    format === f ? "bg-primary-50 text-primary-700" : "text-gray-700"
                  )}
                >
                  {FORMAT_LABELS[f]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
