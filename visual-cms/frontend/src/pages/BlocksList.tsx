import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { Header } from '@/shared/components/Header'
import { ImportModal } from '@/shared/components/ImportModal'
import { Plus, Loader2, Box, Calendar, Pencil, Trash2, Upload } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { 
  fetchBlocks, 
  deleteBlock,
  selectBlocks, 
  selectBlocksLoading,
  selectBlocksError 
} from '@/features/blocks/blocksSlice'
import type { BlockNode } from '@/shared/types'

export const BlocksList: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const blocks = useAppSelector(selectBlocks)
  const loading = useAppSelector(selectBlocksLoading)
  const error = useAppSelector(selectBlocksError)
  const [showImportModal, setShowImportModal] = useState(false)

  useEffect(() => {
    dispatch(fetchBlocks())
  }, [dispatch])

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Удалить блок "${name}"?`)) {
      dispatch(deleteBlock(id))
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Блоки</h1>
            <p className="text-gray-600 mt-1">Библиотека переиспользуемых компонентов</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowImportModal(true)}>
              <Upload size={16} className="mr-2" />
              Импорт
            </Button>
            <Link to="/editor/block/new">
              <Button>
                <Plus size={16} className="mr-2" />
                Создать блок
              </Button>
            </Link>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            Ошибка загрузки: {error}
          </div>
        )}

        {!loading && !error && blocks.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-12 text-center">
              <p className="text-gray-500 mb-4">Блоки еще не созданы</p>
              <Link to="/editor/block/new">
                <Button>
                  <Plus size={16} className="mr-2" />
                  Создать первый блок
                </Button>
              </Link>
            </div>
          </div>
        )}

        {!loading && blocks.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {blocks.map((block) => (
              <div 
                key={block.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Thumbnail / Preview */}
                <div className="h-32 bg-gray-100 flex items-center justify-center">
                  {block.thumbnail ? (
                    <img 
                      src={block.thumbnail} 
                      alt={block.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Box className="w-12 h-12 text-gray-300" />
                  )}
                </div>
                
                {/* Info */}
                <div className="p-4">
                  <h3 className="font-medium text-gray-900 mb-1 truncate">
                    {block.name}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                    <Calendar size={12} />
                    <span>{formatDate(block.updatedAt)}</span>
                    {block.isReusable && (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                        Переисп.
                      </span>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link 
                      to={`/editor/block/${block.id}`}
                      className="flex-1"
                    >
                      <Button variant="secondary" size="sm" className="w-full">
                        <Pencil size={14} className="mr-1" />
                        Редактировать
                      </Button>
                    </Link>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDelete(block.id, block.name)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        type="block"
        onImport={(node: BlockNode, name: string) => {
          // Сохраняем импортированную структуру в sessionStorage и переходим в редактор
          sessionStorage.setItem('importedContent', JSON.stringify({ node, name, type: 'block' }))
          navigate('/editor/block/new')
        }}
      />
    </div>
  )
}
