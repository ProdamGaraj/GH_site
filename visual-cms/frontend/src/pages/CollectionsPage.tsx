import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { Header } from '@/shared/components/Header'
import { Plus, Trash2, Layers, Rocket, Edit, ToggleLeft, ToggleRight } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  fetchCollections,
  deleteCollection,
  deployCollection,
  updateCollection,
  selectCollections,
  selectCollectionsLoading,
  selectCollectionsDeploying,
} from '@/features/collections/collectionsSlice'

export const CollectionsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const collections = useAppSelector(selectCollections)
  const loading = useAppSelector(selectCollectionsLoading)
  const deploying = useAppSelector(selectCollectionsDeploying)
  const navigate = useNavigate()

  const [deployingId, setDeployingId] = useState<string | null>(null)

  useEffect(() => {
    dispatch(fetchCollections())
  }, [dispatch])

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Удалить коллекцию "${name}"? Генерированные страницы останутся, но перестанут обновляться.`)) return
    try {
      await dispatch(deleteCollection(id)).unwrap()
    } catch (err) {
      console.error('Failed to delete collection:', err)
    }
  }

  const handleDeploy = async (id: string) => {
    setDeployingId(id)
    try {
      const result = await dispatch(deployCollection(id)).unwrap()
      alert(`Опубликовано ${result.deployedPages.length} страниц${result.errors.length ? `\nОшибки: ${result.errors.join(', ')}` : ''}`)
    } catch (err) {
      console.error('Failed to deploy collection:', err)
    } finally {
      setDeployingId(null)
    }
  }

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await dispatch(updateCollection({ id, data: { isActive: !currentActive } })).unwrap()
    } catch (err) {
      console.error('Failed to toggle collection:', err)
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Коллекции</h1>
            <p className="text-gray-600 mt-1">Динамические страницы из шаблонов и API данных</p>
          </div>
          <Button onClick={() => navigate('/collections/new')}>
            <Plus size={16} className="mr-2" />
            Создать коллекцию
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Загрузка...</div>
          </div>
        ) : collections.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-12 text-center">
              <Layers size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">Коллекции ещё не созданы</p>
              <Button onClick={() => navigate('/collections/new')}>
                <Plus size={16} className="mr-2" />
                Создать первую коллекцию
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {collections.map((col) => (
              <div
                key={col.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{col.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${col.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {col.isActive ? 'Активна' : 'Неактивна'}
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {col.linkMode === 'auto' ? 'Авто-ссылки' : 'Ручные'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="font-mono">{col.basePath}</span>
                      <span>slug: {col.slugField}</span>
                      <span>title: {col.titleField}</span>
                      {col.overrides?.length > 0 && (
                        <span>{col.overrides.length} переопределений</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleToggleActive(col.id, col.isActive)}
                      className={`p-2 rounded-lg transition-colors ${col.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                      title={col.isActive ? 'Деактивировать' : 'Активировать'}
                    >
                      {col.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    </button>
                    <button
                      onClick={() => handleDeploy(col.id)}
                      disabled={deployingId === col.id || deploying}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Опубликовать коллекцию"
                    >
                      <Rocket size={18} />
                    </button>
                    <Link
                      to={`/collections/${col.id}`}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Редактировать"
                    >
                      <Edit size={18} />
                    </Link>
                    <button
                      onClick={() => handleDelete(col.id, col.name)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Удалить"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CollectionsPage
