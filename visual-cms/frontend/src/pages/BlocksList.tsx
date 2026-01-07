import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { Header } from '@/shared/components/Header'
import { Plus } from 'lucide-react'

export const BlocksList: React.FC = () => {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Блоки</h1>
          <p className="text-gray-600 mt-1">Библиотека переиспользуемых компонентов</p>
        </div>
        <Link to="/editor/block/new">
          <Button>
            <Plus size={16} className="mr-2" />
            Создать блок
          </Button>
        </Link>
      </div>

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
      </div>
    </div>
  )
}
