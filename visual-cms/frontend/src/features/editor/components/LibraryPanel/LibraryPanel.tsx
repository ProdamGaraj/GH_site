import React from 'react'
// import { ChevronLeft } from 'lucide-react'
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
  {
    name: 'Код',
    items: [
      { type: 'html-code', label: 'HTML код', icon: 'Code', tagName: 'div',
        defaultProps: {
          content: '<!-- Вставьте HTML код сюда -->\n<div style="padding: 20px;">\n  <p>Пример HTML</p>\n</div>',
          metadata: { name: 'HTML код' },
        },
      },
    ],
  },
]

interface LibraryPanelProps {
  isOpen: boolean
  onToggle: () => void
}

export const LibraryPanel: React.FC<LibraryPanelProps> = () => {
  return (
    <>
      {categories.map((category) => (
        <LibraryCategory key={category.name} category={category} />
      ))}
    </>
  )
}
