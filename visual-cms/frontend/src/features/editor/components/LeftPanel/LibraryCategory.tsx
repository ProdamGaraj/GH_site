import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { LibraryItem } from './LibraryItem'
import type { LibraryCategory as LibraryCategoryType } from '@/shared/types'

interface LibraryCategoryProps {
  category: LibraryCategoryType
}

export const LibraryCategory: React.FC<LibraryCategoryProps> = ({ category }) => {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className="library-category">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded"
      >
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {category.name}
      </button>
      
      {isExpanded && (
        <div className="mt-2 space-y-1">
          {category.items.map((item) => (
            <LibraryItem key={item.label} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
