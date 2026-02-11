import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, FileText, Box, Database, Settings, Menu, Send } from 'lucide-react'

interface HeaderProps {
  showActions?: React.ReactNode
  centerActions?: React.ReactNode  // Действия на странице (масштаб, цвета)
  rightActions?: React.ReactNode   // Действия со страницей (сохранить, экспорт)
}

export const Header: React.FC<HeaderProps> = ({ showActions, centerActions, rightActions }) => {
  const location = useLocation()
  const [showNavDropdown, setShowNavDropdown] = useState(false)

  const navItems = [
    { path: '/', icon: Home, label: 'Главная' },
    { path: '/pages', icon: FileText, label: 'Страницы' },
    { path: '/blocks', icon: Box, label: 'Блоки' },
    { path: '/data-sources', icon: Database, label: 'Data Sources' },
    { path: '/forms', icon: Send, label: 'Формы' },
    { path: '/settings', icon: Settings, label: 'Настройки' },
  ]

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  // Check if we're in the editor
  const isInEditor = location.pathname.includes('/editor/')

  // Если есть centerActions или rightActions - используем 3-колоночную структуру
  const hasThreeColumns = centerActions || rightActions

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
      {/* 1. Лого и меню */}
      <div className="flex items-center gap-6">
        {/* Logo */}
        <div className="font-bold text-lg text-gray-900">Visual CMS</div>

        {/* Navigation - show inline on non-editor pages, dropdown on editor */}
        {isInEditor ? (
          <div className="relative">
            <button
              onClick={() => setShowNavDropdown(!showNavDropdown)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              title="Навигация"
            >
              <Menu size={18} />
              <span>Меню</span>
            </button>
            
            {showNavDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowNavDropdown(false)}
                />
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px] py-1">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const active = isActive(item.path)
                    
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setShowNavDropdown(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                          active
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <Icon size={18} />
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        ) : (
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        )}
      </div>

      {/* 2. Центр - действия на странице (масштаб, цвета, viewport и т.д.) */}
      {hasThreeColumns ? (
        <>
          <div className="flex items-center gap-2">
            {centerActions}
          </div>

          {/* 3. Справа - действия со страницей (сохранить, экспорт, публикация) */}
          <div className="flex items-center gap-2">
            {rightActions}
          </div>
        </>
      ) : (
        /* Fallback для старого API с showActions */
        showActions && (
          <div className="flex items-center gap-2">
            {showActions}
          </div>
        )
      )}
    </header>
  )
}

