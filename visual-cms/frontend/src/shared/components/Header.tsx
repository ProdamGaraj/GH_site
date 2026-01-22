import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, FileText, Box, Database, Settings, Menu } from 'lucide-react'

interface HeaderProps {
  showActions?: React.ReactNode
  centerActions?: React.ReactNode  // Р”РµР№СЃС‚РІРёСЏ РЅР° СЃС‚СЂР°РЅРёС†Рµ (РјР°СЃС€С‚Р°Р±, С†РІРµС‚Р°)
  rightActions?: React.ReactNode   // Р”РµР№СЃС‚РІРёСЏ СЃРѕ СЃС‚СЂР°РЅРёС†РµР№ (СЃРѕС…СЂР°РЅРёС‚СЊ, СЌРєСЃРїРѕСЂС‚)
}

export const Header: React.FC<HeaderProps> = ({ showActions, centerActions, rightActions }) => {
  const location = useLocation()
  const [showNavDropdown, setShowNavDropdown] = useState(false)

  const navItems = [
    { path: '/', icon: Home, label: 'Р“Р»Р°РІРЅР°СЏ' },
    { path: '/pages', icon: FileText, label: 'РЎС‚СЂР°РЅРёС†С‹' },
    { path: '/blocks', icon: Box, label: 'Р‘Р»РѕРєРё' },
    { path: '/data-sources', icon: Database, label: 'Data Sources' },
    { path: '/settings', icon: Settings, label: 'РќР°СЃС‚СЂРѕР№РєРё' },
  ]

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  // Check if we're in the editor
  const isInEditor = location.pathname.includes('/editor/')

  // Р•СЃР»Рё РµСЃС‚СЊ centerActions РёР»Рё rightActions - РёСЃРїРѕР»СЊР·СѓРµРј 3-РєРѕР»РѕРЅРѕС‡РЅСѓСЋ СЃС‚СЂСѓРєС‚СѓСЂСѓ
  const hasThreeColumns = centerActions || rightActions

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
      {/* 1. Р›РѕРіРѕ Рё РјРµРЅСЋ */}
      <div className="flex items-center gap-6">
        {/* Logo */}
        <div className="font-bold text-lg text-gray-900">Visual CMS</div>

        {/* Navigation - show inline on non-editor pages, dropdown on editor */}
        {isInEditor ? (
          <div className="relative">
            <button
              onClick={() => setShowNavDropdown(!showNavDropdown)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              title="РќР°РІРёРіР°С†РёСЏ"
            >
              <Menu size={18} />
              <span>РњРµРЅСЋ</span>
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

      {/* 2. Р¦РµРЅС‚СЂ - РґРµР№СЃС‚РІРёСЏ РЅР° СЃС‚СЂР°РЅРёС†Рµ (РјР°СЃС€С‚Р°Р±, С†РІРµС‚Р°, viewport Рё С‚.Рґ.) */}
      {hasThreeColumns ? (
        <>
          <div className="flex items-center gap-2">
            {centerActions}
          </div>

          {/* 3. РЎРїСЂР°РІР° - РґРµР№СЃС‚РІРёСЏ СЃРѕ СЃС‚СЂР°РЅРёС†РµР№ (СЃРѕС…СЂР°РЅРёС‚СЊ, СЌРєСЃРїРѕСЂС‚, РїСѓР±Р»РёРєР°С†РёСЏ) */}
          <div className="flex items-center gap-2">
            {rightActions}
          </div>
        </>
      ) : (
        /* Fallback РґР»СЏ СЃС‚Р°СЂРѕРіРѕ API СЃ showActions */
        showActions && (
          <div className="flex items-center gap-2">
            {showActions}
          </div>
        )
      )}
    </header>
  )
}

