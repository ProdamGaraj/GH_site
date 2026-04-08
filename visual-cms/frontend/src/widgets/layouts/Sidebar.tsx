import React from 'react'
import { NavLink } from 'react-router-dom'
import { Home, FileText, Box, Settings, Globe, Layers } from 'lucide-react'
import { cn } from '@/shared/utils'

const menuItems = [
  { path: '/', label: 'Главная', icon: Home },
  { path: '/sites', label: 'Сайты', icon: Globe },
  { path: '/collections', label: 'Коллекции', icon: Layers },
  { path: '/pages', label: 'Страницы', icon: FileText },
  { path: '/blocks', label: 'Блоки', icon: Box },
  { path: '/settings', label: 'Настройки', icon: Settings },
]

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Visual CMS</h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                'text-gray-700 hover:bg-gray-100',
                isActive && 'bg-primary-50 text-primary-700 font-medium'
              )}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
