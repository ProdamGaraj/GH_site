import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { Header } from '@/shared/components/Header'
import { ImportModal } from '@/shared/components/ImportModal'
import { Plus, Edit, Trash2, ExternalLink, Upload, Globe } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { fetchPages, deletePage, selectPages, selectPagesLoading } from '@/features/pages/pagesSlice'
import type { BlockNode } from '@/shared/types'
import { getPagePublicUrl } from '@/shared/utils'

export const PagesList: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const pages = useAppSelector(selectPages)
  const loading = useAppSelector(selectPagesLoading)
  const [showImportModal, setShowImportModal] = useState(false)

  useEffect(() => {
    dispatch(fetchPages())
  }, [dispatch])

  const handleDelete = async (id: string) => {
    if (window.confirm('Вы уверены, что хотите удалить эту страницу?')) {
      try {
        await dispatch(deletePage(id)).unwrap()
      } catch (error) {
        console.error('Failed to delete page:', error)
      }
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700',
      published: 'bg-green-100 text-green-700',
      archived: 'bg-red-100 text-red-700',
    }
    const labels = {
      draft: 'Черновик',
      published: 'Опубликовано',
      archived: 'Архив',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.draft}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Страницы</h1>
            <p className="text-gray-600 mt-1">Управление страницами сайта</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowImportModal(true)}>
              <Upload size={16} className="mr-2" />
              Импорт
            </Button>
            <Link to="/editor/page/new">
              <Button>
                <Plus size={16} className="mr-2" />
                Создать страницу
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Загрузка...</div>
          </div>
        ) : pages.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-12 text-center">
              <p className="text-gray-500 mb-4">Страницы еще не созданы</p>
              <Link to="/editor/page/new">
                <Button>
                  <Plus size={16} className="mr-2" />
                  Создать первую страницу
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Slug
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Сайт
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата создания
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pages.map((page) => (
                  <tr key={page.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{page.name}</div>
                      {page.metadata?.title && page.metadata.title !== page.name && (
                        <div className="text-xs text-gray-500">SEO: {page.metadata.title}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-mono">/{page.slug}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(page.status || 'draft')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {page.site ? (
                        <Link to={`/sites/${page.site.id}/pages`} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-900">
                          <Globe size={14} />
                          {page.site.name}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(page.createdAt).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {page.status === 'published' && page.site && (
                          <a
                            href={getPagePublicUrl(page.site, page.slug)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-900"
                            title="Просмотр на сайте"
                          >
                            <ExternalLink size={18} />
                          </a>
                        )}
                        <Link
                          to={`/editor/page/${page.id}`}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Редактировать"
                        >
                          <Edit size={18} />
                        </Link>
                        <button
                          onClick={() => handleDelete(page.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Удалить"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        type="page"
        onImport={(node: BlockNode, name: string) => {
          // Сохраняем импортированную структуру в sessionStorage и переходим в редактор
          sessionStorage.setItem('importedContent', JSON.stringify({ node, name, type: 'page' }))
          navigate('/editor/page/new')
        }}
      />
    </div>
  )
}
