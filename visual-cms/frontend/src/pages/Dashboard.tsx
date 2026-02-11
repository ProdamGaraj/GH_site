import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { Header } from '@/shared/components/Header'
import { FileText, Box, Plus, Loader2, Database, Layout, Send } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { fetchBlocks, selectBlocks, selectBlocksLoading } from '@/features/blocks/blocksSlice'
import { fetchPages, selectPages, selectPagesLoading } from '@/features/pages/pagesSlice'
import { fetchDataSources, selectDataSources, selectDataSourcesLoading } from '@/features/data-sources/dataSourcesSlice'
import { fetchTemplates, selectTemplates, selectTemplatesLoading } from '@/features/templates'
import { fetchForms } from '@/features/forms/formsSlice'

export const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch()
  const blocks = useAppSelector(selectBlocks)
  const blocksLoading = useAppSelector(selectBlocksLoading)
  const pages = useAppSelector(selectPages)
  const pagesLoading = useAppSelector(selectPagesLoading)
  const dataSources = useAppSelector(selectDataSources)
  const dataSourcesLoading = useAppSelector(selectDataSourcesLoading)
  const templates = useAppSelector(selectTemplates)
  const templatesLoading = useAppSelector(selectTemplatesLoading)
  const forms = useAppSelector((state) => state.forms.items)
  const formsLoading = useAppSelector((state) => state.forms.loading)

  useEffect(() => {
    dispatch(fetchBlocks())
    dispatch(fetchPages())
    dispatch(fetchDataSources({}))
    dispatch(fetchTemplates({}))
    dispatch(fetchForms())
  }, [dispatch])

  const publishedPages = pages.filter(p => p.status === 'published')

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Добро пожаловать в Visual CMS
        </h1>
        <p className="text-gray-600">
          Создавайте страницы и блоки с помощью визуального редактора
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {/* Pages Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary-100 rounded-lg">
              <FileText className="text-primary-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Страницы</h2>
              <p className="text-sm text-gray-600">Управление страницами сайта</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link to="/pages" className="flex-1">
              <Button variant="secondary" className="w-full">
                Все страницы
              </Button>
            </Link>
            <Link to="/editor/page/new">
              <Button>
                <Plus size={16} className="mr-2" />
                Создать
              </Button>
            </Link>
          </div>
        </div>

        {/* Blocks Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Box className="text-purple-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Блоки</h2>
              <p className="text-sm text-gray-600">Библиотека переиспользуемых блоков</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link to="/blocks" className="flex-1">
              <Button variant="secondary" className="w-full">
                Все блоки
              </Button>
            </Link>
            <Link to="/editor/block/new">
              <Button>
                <Plus size={16} className="mr-2" />
                Создать
              </Button>
            </Link>
          </div>
        </div>

        {/* Data Sources Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Database className="text-green-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Источники данных</h2>
              <p className="text-sm text-gray-600">API, базы данных, файлы</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link to="/data-sources" className="flex-1">
              <Button variant="secondary" className="w-full">
                Все источники
              </Button>
            </Link>
            <Link to="/data-sources?new=true">
              <Button>
                <Plus size={16} className="mr-2" />
                Создать
              </Button>
            </Link>
          </div>
        </div>

        {/* Templates Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <Layout className="text-indigo-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Шаблоны</h2>
              <p className="text-sm text-gray-600">Шаблоны для повторяющихся элементов</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link to="/templates" className="flex-1">
              <Button variant="secondary" className="w-full">
                Все шаблоны
              </Button>
            </Link>
            <Link to="/templates?new=true">
              <Button>
                <Plus size={16} className="mr-2" />
                Создать
              </Button>
            </Link>
          </div>
        </div>

        {/* Forms Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Send className="text-orange-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Формы</h2>
              <p className="text-sm text-gray-600">Формы обратной связи и передача данных</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link to="/forms" className="flex-1">
              <Button variant="secondary" className="w-full">
                Все формы
              </Button>
            </Link>
            <Link to="/forms/new">
              <Button>
                <Plus size={16} className="mr-2" />
                Создать
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mt-8 grid grid-cols-6 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Всего страниц</p>
          {pagesLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          ) : (
            <p className="text-3xl font-bold text-gray-900">{pages.length}</p>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Всего блоков</p>
          {blocksLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          ) : (
            <p className="text-3xl font-bold text-gray-900">{blocks.length}</p>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Источников данных</p>
          {dataSourcesLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          ) : (
            <p className="text-3xl font-bold text-gray-900">{dataSources.length}</p>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Шаблонов</p>
          {templatesLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          ) : (
            <p className="text-3xl font-bold text-gray-900">{templates.length}</p>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Опубликовано</p>
          {pagesLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          ) : (
            <p className="text-3xl font-bold text-gray-900">{publishedPages.length}</p>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Форм</p>
          {formsLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          ) : (
            <p className="text-3xl font-bold text-gray-900">{forms.length}</p>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
