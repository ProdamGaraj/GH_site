import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { Header } from '@/shared/components/Header'
import { FileText, Box, Plus } from 'lucide-react'

export const Dashboard: React.FC = () => {
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      </div>

      {/* Quick Stats */}
      <div className="mt-8 grid grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Всего страниц</p>
          <p className="text-3xl font-bold text-gray-900">0</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Всего блоков</p>
          <p className="text-3xl font-bold text-gray-900">0</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Опубликовано</p>
          <p className="text-3xl font-bold text-gray-900">0</p>
        </div>
      </div>
      </div>
    </div>
  )
}
