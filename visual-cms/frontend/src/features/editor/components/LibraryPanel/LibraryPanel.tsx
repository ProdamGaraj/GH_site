import React from 'react'
import { ChevronLeft } from 'lucide-react'
import { LibraryCategory } from '../LeftPanel/LibraryCategory'
import type { LibraryCategory as LibraryCategoryType } from '@/shared/types'

const categories: LibraryCategoryType[] = [
  {
    name: 'Контейнеры',
    items: [
      { type: 'container', label: 'Div', icon: 'Box', tagName: 'div' },
      { type: 'container', label: 'Section', icon: 'Layout', tagName: 'section' },
      { type: 'container', label: 'Article', icon: 'FileText', tagName: 'article' },
      { type: 'container', label: 'Header', icon: 'LayoutHeader', tagName: 'header' },
      { type: 'container', label: 'Footer', icon: 'LayoutFooter', tagName: 'footer' },
    ],
  },
  {
    name: 'Ввод данных',
    items: [
      { type: 'input', label: 'Text Input', icon: 'Type', tagName: 'input' },
      { type: 'input', label: 'Textarea', icon: 'AlignLeft', tagName: 'textarea' },
      { type: 'button', label: 'Button', icon: 'Square', tagName: 'button' },
    ],
  },
  {
    name: 'Вывод данных',
    items: [
      { type: 'text', label: 'Heading', icon: 'Heading', tagName: 'h1' },
      { type: 'text', label: 'Paragraph', icon: 'Type', tagName: 'p' },
      { type: 'image', label: 'Image', icon: 'Image', tagName: 'img' },
      { type: 'link', label: 'Link', icon: 'Link', tagName: 'a' },
    ],
  },
]

interface LibraryPanelProps {
  isOpen: boolean
  onToggle: () => void
}

export const LibraryPanel: React.FC<LibraryPanelProps> = ({ isOpen, onToggle }) => {
  if (!isOpen) {
    return (
      <div className="w-8 bg-gray-100 border-gray-200 flex flex-col items-center">
        <button
          onClick={onToggle}
          className="h-14 flex items-center justify-center hover:bg-gray-200 transition-colors border-b border-r border-gray-200 w-full"
          title="Показать библиотеку"
        >
          <ChevronLeft size={20} className="text-gray-600 rotate-180" />
        </button>
      </div>
    )
  }

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Библиотека элементов</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Перетащите элементы на холст
          </p>
        </div>
        <button
          onClick={onToggle}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          title="Скрыть библиотеку"
        >
          <ChevronLeft size={18} className="text-gray-600" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {categories.map((category) => (
          <LibraryCategory key={category.name} category={category} />
        ))}
      </div>
    </div>
  )
}
