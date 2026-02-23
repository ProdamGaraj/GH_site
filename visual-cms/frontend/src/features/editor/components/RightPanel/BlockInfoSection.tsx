import React, { useState, useEffect } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { updateNode } from '@/features/editor/editorSlice'
import { blockApi } from '@/shared/api'
import { Button } from '@/shared/components/Button'
import { Link2, Link2Off, AlertCircle, FileText, Puzzle, ExternalLink } from 'lucide-react'
import type { BlockNode } from '@/shared/types'

interface BlockUsage {
  type: 'page' | 'block'
  id: string
  name: string
  nodePath?: string
}

interface BlockInfoSectionProps {
  node: BlockNode
  pageId?: string
}

export const BlockInfoSection: React.FC<BlockInfoSectionProps> = ({ node }) => {
  const dispatch = useAppDispatch()
  const [loading, setLoading] = useState(false)
  const [usages, setUsages] = useState<BlockUsage[]>([])
  const [usagesLoading, setUsagesLoading] = useState(false)

  const isLinked = !!node.metadata?.linkedBlockId

  // Загружаем usages при монтировании и когда меняется linkedBlockId
  useEffect(() => {
    if (!isLinked || !node.metadata?.linkedBlockId) return

    let cancelled = false
    setUsagesLoading(true)

    blockApi.getUsages(node.metadata.linkedBlockId)
      .then(data => {
        if (!cancelled) setUsages(data)
      })
      .catch(err => {
        console.error('Failed to load block usages:', err)
        if (!cancelled) setUsages([])
      })
      .finally(() => {
        if (!cancelled) setUsagesLoading(false)
      })

    return () => { cancelled = true }
  }, [isLinked, node.metadata?.linkedBlockId])

  const handleUnlink = async () => {
    if (!confirm(
      'Открепить блок от библиотеки?\n\n' +
      'После открепления:\n' +
      '• Изменения в библиотеке НЕ будут применяться к этому блоку\n' +
      '• Блок станет полностью независимым\n' +
      '• Это действие нельзя отменить'
    )) {
      return
    }

    setLoading(true)
    try {
      // Удаляем linkedBlockId из metadata
      const updatedMetadata = { ...node.metadata }
      delete updatedMetadata.linkedBlockId

      // Обновляем узел в Redux
      dispatch(updateNode({
        id: node.id,
        updates: {
          metadata: updatedMetadata
        }
      }))

      // Показываем уведомление
      setTimeout(() => {
        alert('✅ Блок откреплён от библиотеки\n\nТеперь это независимый элемент страницы.')
      }, 100)
    } catch (error) {
      console.error('Failed to unlink block:', error)
      alert('❌ Ошибка при откреплении блока')
    } finally {
      setLoading(false)
    }
  }

  if (!isLinked) {
    return null // Не показываем секцию для обычных элементов
  }

  return (
    <div className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Link2 size={18} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-900 mb-1">
              Связан с библиотекой блоков
            </h4>
            <p className="text-xs text-blue-700 leading-relaxed">
              Этот блок синхронизирован с библиотекой. Изменения в библиотеке будут 
              применяться к этому экземпляру при обновлении.
            </p>
          </div>
        </div>

        {/* Linked Block Info */}
        <div className="bg-white rounded-lg border border-blue-200 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Block ID</span>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-800">
              {node.metadata.linkedBlockId?.slice(0, 8)}...
            </code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Status</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
              🔗 Linked
            </span>
          </div>
        </div>

        {/* Usages */}
        <div className="bg-white rounded-lg border border-blue-200 p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-700">Используется на:</span>
            {usagesLoading && (
              <span className="text-xs text-gray-400 animate-pulse">загрузка...</span>
            )}
          </div>
          {!usagesLoading && usages.length === 0 && (
            <p className="text-xs text-gray-400 italic">Нет привязок к страницам</p>
          )}
          {!usagesLoading && usages.length > 0 && (
            <ul className="space-y-1.5">
              {usages.map((u, idx) => (
                <li key={`${u.id}-${idx}`} className="flex items-center gap-2 text-xs">
                  {u.type === 'page' ? (
                    <FileText size={12} className="text-blue-500 flex-shrink-0" />
                  ) : (
                    <Puzzle size={12} className="text-purple-500 flex-shrink-0" />
                  )}
                  <span className="truncate text-gray-700" title={u.name}>
                    {u.name || u.id.slice(0, 8)}
                  </span>
                  <a
                    href={u.type === 'page' ? `/pages/${u.id}` : `/blocks/${u.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-blue-500 hover:text-blue-700 flex-shrink-0"
                    title="Открыть"
                  >
                    <ExternalLink size={11} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Внимание:</strong> Открепление блока сделает его полностью независимым. 
            Глобальные обновления из библиотеки больше не будут применяться.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUnlink}
            disabled={loading}
            className="flex-1 border border-red-200 hover:bg-red-50 hover:border-red-300 text-red-700"
          >
            <Link2Off size={14} className="mr-2" />
            {loading ? 'Открепление...' : 'Открепить от библиотеки'}
          </Button>
        </div>
      </div>
    </div>
  )
}
