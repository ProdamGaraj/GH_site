import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { Header } from '@/shared/components/Header'
import { ArrowLeft, Plus, Edit, X, FileText } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { fetchSiteById, selectCurrentSite } from '@/features/sites/sitesSlice'
import { fetchPages, selectPages } from '@/features/pages/pagesSlice'
import { siteApi } from '@/shared/api'
import type { Page } from '@/shared/types'

export const SitePagesPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const dispatch = useAppDispatch()
  const site = useAppSelector(selectCurrentSite)
  const allPages = useAppSelector(selectPages)

  const [sitePages, setSitePages] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)
  const [showAssignModal, setShowAssignModal] = useState(false)

  useEffect(() => {
    if (id) {
      dispatch(fetchSiteById(id))
      dispatch(fetchPages())
      loadSitePages()
    }
  }, [id, dispatch])

  const loadSitePages = async () => {
    if (!id) return
    setLoading(true)
    try {
      const pages = await siteApi.getPages(id)
      setSitePages(pages)
    } catch (error) {
      console.error('Failed to load site pages:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = async (pageId: string) => {
    if (!id) return
    try {
      await siteApi.assignPage(id, pageId)
      await loadSitePages()
      setShowAssignModal(false)
    } catch (error) {
      console.error('Failed to assign page:', error)
    }
  }

  const handleUnassign = async (pageId: string) => {
    if (!id) return
    if (!window.confirm('Открепить страницу от сайта?')) return
    try {
      await siteApi.unassignPage(id, pageId)
      await loadSitePages()
    } catch (error) {
      console.error('Failed to unassign page:', error)
    }
  }

  const unassignedPages = allPages.filter(
    (p) => !sitePages.some((sp) => sp.id === p.id)
  )

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mb-6">
          <Link to="/sites" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft size={16} />
            Назад к сайтам
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Страницы: {site?.name || '...'}
              </h1>
              <p className="text-gray-600 mt-1">Управление страницами сайта</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowAssignModal(true)}>
                <Plus size={16} className="mr-2" />
                Добавить страницу
              </Button>
              <Link to="/editor/page/new">
                <Button>
                  <Plus size={16} className="mr-2" />
                  Создать новую
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Загрузка...</div>
          </div>
        ) : sitePages.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">В этом сайте пока нет страниц</p>
            <Button onClick={() => setShowAssignModal(true)}>
              <Plus size={16} className="mr-2" />
              Добавить существующую страницу
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sitePages.map((page) => (
                  <tr key={page.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{page.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-mono">/{page.slug}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        page.status === 'published' ? 'bg-green-100 text-green-700' :
                        page.status === 'archived' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {page.status === 'published' ? 'Опубликовано' :
                         page.status === 'archived' ? 'Архив' : 'Черновик'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/editor/page/${page.id}`}
                          className="p-1 text-indigo-600 hover:text-indigo-900"
                          title="Редактировать"
                        >
                          <Edit size={18} />
                        </Link>
                        <button
                          onClick={() => handleUnassign(page.id)}
                          className="p-1 text-red-600 hover:text-red-900"
                          title="Открепить от сайта"
                        >
                          <X size={18} />
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

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAssignModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-semibold mb-4">Добавить страницу в сайт</h2>
            {unassignedPages.length === 0 ? (
              <p className="text-gray-500 py-8 text-center">Все страницы уже привязаны к этому сайту</p>
            ) : (
              <ul className="flex-1 overflow-y-auto space-y-1">
                {unassignedPages.map((page) => (
                  <li key={page.id}>
                    <button
                      onClick={() => handleAssign(page.id)}
                      className="w-full text-left px-4 py-3 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{page.name}</div>
                        <div className="text-sm text-gray-500 font-mono">/{page.slug}</div>
                      </div>
                      <Plus size={16} className="text-blue-600" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end mt-4 pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowAssignModal(false)}>Закрыть</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
