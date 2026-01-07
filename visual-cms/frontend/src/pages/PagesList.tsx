import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { Header } from '@/shared/components/Header'
import { Plus } from 'lucide-react'

export const PagesList: React.FC = () => {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Страницы</h1>
          <p className="text-gray-600 mt-1">Управление страницами сайта</p>
        </div>
        <Link to="/editor/page/new">
          <Button>
            <Plus size={16} className="mr-2" />
            Создать страницу
          </Button>
        </Link>
      </div>

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
      </div>
    </div>
  )
}
