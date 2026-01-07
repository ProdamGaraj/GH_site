import React from 'react'
import { Button } from '@/shared/components/Button'
import { Save, Eye, Undo, Redo } from 'lucide-react'

interface EditorToolbarProps {
  type: 'page' | 'block'
}

export const EditorToolbar: React.FC<EditorToolbarProps> = () => {
  const handleSave = () => {
    // TODO: Implement save
    console.log('Saving...')
  }

  const handlePreview = () => {
    // TODO: Implement preview
    console.log('Preview...')
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" disabled>
        <Undo size={16} />
      </Button>
      <Button variant="ghost" size="sm" disabled>
        <Redo size={16} />
      </Button>
      
      <div className="h-6 w-px bg-gray-300 mx-2" />
      
      <Button variant="secondary" size="sm" onClick={handlePreview}>
        <Eye size={16} className="mr-2" />
        Предпросмотр
      </Button>
      <Button size="sm" onClick={handleSave}>
        <Save size={16} className="mr-2" />
        Сохранить
      </Button>
    </div>
  )
}
