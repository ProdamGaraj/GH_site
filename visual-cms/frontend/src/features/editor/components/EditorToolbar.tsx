import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { Save, Eye, Undo, Redo, X, Check, Loader2 } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { selectRootNode, selectIsDirty, markAsSaved } from '@/features/editor/editorSlice'
import { createBlock, updateBlock, selectBlocksSaving } from '@/features/blocks/blocksSlice'

interface EditorToolbarProps {
  type: 'page' | 'block'
  blockId?: string
  blockName?: string
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ 
  type: _type, 
  blockId: _blockId,
  blockName: initialBlockName 
}) => {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  
  const rootNode = useAppSelector(selectRootNode)
  const isDirty = useAppSelector(selectIsDirty)
  const isSaving = useAppSelector(selectBlocksSaving)
  
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [blockName, setBlockName] = useState(initialBlockName || '')
  const [isReusable, setIsReusable] = useState(true)

  const isNewBlock = id === 'new' || !id

  const handleSave = async () => {
    if (!rootNode) return

    if (isNewBlock) {
      // Show dialog to enter name
      setShowSaveDialog(true)
    } else {
      // Update existing block
      try {
        await dispatch(updateBlock({
          id: id!,
          data: {
            structure: rootNode,
          }
        })).unwrap()
        
        dispatch(markAsSaved())
      } catch (error) {
        console.error('Failed to save:', error)
      }
    }
  }

  const handleSaveNew = async () => {
    if (!rootNode || !blockName.trim()) return

    try {
      const result = await dispatch(createBlock({
        name: blockName.trim(),
        type: 'static',
        structure: rootNode,
        isReusable,
      })).unwrap()
      
      dispatch(markAsSaved())
      setShowSaveDialog(false)
      
      // Navigate to the new block's edit page
      navigate(`/editor/block/${result.id}`, { replace: true })
    } catch (error) {
      console.error('Failed to create block:', error)
    }
  }

  const handlePreview = () => {
    setShowPreview(true)
  }

  const handleClosePreview = () => {
    setShowPreview(false)
  }

  return (
    <>
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
        <Button 
          size="sm" 
          onClick={handleSave}
          disabled={isSaving || !isDirty}
        >
          {isSaving ? (
            <Loader2 size={16} className="mr-2 animate-spin" />
          ) : (
            <Save size={16} className="mr-2" />
          )}
          Сохранить
        </Button>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Сохранить блок</h2>
            
            <div className="space-y-4">
              <Input
                label="Название блока"
                value={blockName}
                onChange={(e) => setBlockName(e.target.value)}
                placeholder="Введите название..."
                autoFocus
              />
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isReusable}
                  onChange={(e) => setIsReusable(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">
                  Переиспользуемый блок (доступен в библиотеке)
                </span>
              </label>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button 
                variant="secondary" 
                onClick={() => setShowSaveDialog(false)}
              >
                <X size={16} className="mr-2" />
                Отмена
              </Button>
              <Button 
                onClick={handleSaveNew}
                disabled={!blockName.trim() || isSaving}
              >
                {isSaving ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <Check size={16} className="mr-2" />
                )}
                Сохранить
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && rootNode && (
        <PreviewModal 
          rootNode={rootNode} 
          onClose={handleClosePreview} 
        />
      )}
    </>
  )
}

// Preview Modal Component
interface PreviewModalProps {
  rootNode: import('@/shared/types').BlockNode
  onClose: () => void
}

const PreviewModal: React.FC<PreviewModalProps> = ({ rootNode, onClose }) => {
  const [viewportSize, setViewportSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  
  const viewportWidths = {
    desktop: '100%',
    tablet: '768px',
    mobile: '375px',
  }

  // Generate HTML from BlockNode tree
  const generateHTML = (node: import('@/shared/types').BlockNode): string => {
    const styleString = Object.entries(node.styles.properties)
      .filter(([_, value]) => value)
      .map(([key, value]) => {
        // Convert camelCase to kebab-case
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
        return `${cssKey}: ${value}`
      })
      .join('; ')

    const attrs = Object.entries(node.attributes)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ')

    const childrenHTML = node.children.map(child => generateHTML(child)).join('')
    const content = node.content || ''

    return `<${node.tagName} style="${styleString}" ${attrs}>${content}${childrenHTML}</${node.tagName}>`
  }

  const previewHTML = generateHTML(rootNode)

  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col z-[100]">
      {/* Header */}
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="font-medium">Предпросмотр</h2>
          
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            <button
              className={`px-3 py-1 rounded text-sm ${viewportSize === 'desktop' ? 'bg-gray-700' : ''}`}
              onClick={() => setViewportSize('desktop')}
            >
              Desktop
            </button>
            <button
              className={`px-3 py-1 rounded text-sm ${viewportSize === 'tablet' ? 'bg-gray-700' : ''}`}
              onClick={() => setViewportSize('tablet')}
            >
              Tablet
            </button>
            <button
              className={`px-3 py-1 rounded text-sm ${viewportSize === 'mobile' ? 'bg-gray-700' : ''}`}
              onClick={() => setViewportSize('mobile')}
            >
              Mobile
            </button>
          </div>
        </div>
        
        <button 
          onClick={onClose}
          className="p-2 hover:bg-gray-800 rounded"
        >
          <X size={20} />
        </button>
      </div>
      
      {/* Preview Content */}
      <div className="flex-1 overflow-auto p-8 flex justify-center">
        <div 
          className="bg-white shadow-2xl transition-all duration-300 overflow-auto"
          style={{ 
            width: viewportWidths[viewportSize],
            maxWidth: '100%',
            minHeight: '400px',
          }}
        >
          <iframe
            srcDoc={`
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: system-ui, -apple-system, sans-serif; }
                  </style>
                </head>
                <body>${previewHTML}</body>
              </html>
            `}
            className="w-full h-full min-h-[600px] border-0"
            title="Preview"
          />
        </div>
      </div>
    </div>
  )
}
