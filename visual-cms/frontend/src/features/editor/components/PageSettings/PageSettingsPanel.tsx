import React, { useState } from 'react'
import { useAppSelector } from '@/app/hooks'
import { selectViewport, selectBreakpoints } from '@/features/editor/editorSlice'
import { Input } from '@/shared/components/Input'
import { Settings, Globe, Search, FileText, Monitor, Tablet, Smartphone, Laptop, Watch, Settings2, Database } from 'lucide-react'
import { PageSettingsDataTab } from '@/features/pages/components/PageSettingsDataTab'
import type { PageDataConfig, VariablesConfig } from '@/features/dataBindings'

export interface PageSettings {
  name: string
  slug: string
  status: 'draft' | 'published' | 'archived'
  metaTitle: string
  metaDescription: string
  keywords: string
  ogImage: string
  // Data Binding settings
  dataSources?: PageDataConfig
  variables?: VariablesConfig
}

interface PageSettingsPanelProps {
  settings: PageSettings
  onChange: (settings: PageSettings) => void
  pageId?: string
}

export const PageSettingsPanel: React.FC<PageSettingsPanelProps> = ({ 
  settings, 
  onChange,
  pageId = 'current'
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'seo' | 'data'>('general')
  const viewport = useAppSelector(selectViewport)
  const breakpoints = useAppSelector(selectBreakpoints)
  
  const currentBreakpoint = breakpoints.find(bp => bp.id === viewport)
  
  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'monitor': return Monitor
      case 'laptop': return Laptop
      case 'tablet': return Tablet
      case 'smartphone': return Smartphone
      case 'watch': return Watch
      default: return Monitor
    }
  }
  
  const ViewportIcon = viewport === 'base' ? Settings2 : (currentBreakpoint ? getIcon(currentBreakpoint.icon) : Monitor)
  
  const viewportName = viewport === 'base' 
    ? 'Общий' 
    : (currentBreakpoint ? `${currentBreakpoint.name} (${currentBreakpoint.width}px)` : 'Unknown viewport')
  
  const viewportDescription = viewport === 'base'
    ? 'Изменения применяются для всех viewport'
    : `Изменения применяются для ${currentBreakpoint?.name || 'этого экрана'}`

  const handleChange = (field: keyof PageSettings, value: string) => {
    onChange({
      ...settings,
      [field]: value,
    })
  }

  return (
    <>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2 text-gray-700">
          <Settings size={18} />
          <h3 className="font-medium">Настройки страницы</h3>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'general'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={() => setActiveTab('general')}
        >
          <FileText size={16} className="inline mr-1.5" />
          Основное
        </button>
        <button
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'seo'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={() => setActiveTab('seo')}
        >
          <Search size={16} className="inline mr-1.5" />
          SEO
        </button>
        <button
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'data'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={() => setActiveTab('data')}
        >
          <Database size={16} className="inline mr-1.5" />
          Data
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Viewport indicator */}
        <div className="mb-3 px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <ViewportIcon size={16} className="text-primary-600" />
            <span className="text-primary-700 font-medium">
              {viewportName}
            </span>
          </div>
          <p className="text-xs text-primary-600 mt-1">
            {viewportDescription}
          </p>
        </div>
        
        {activeTab === 'general' && (
          <>
            <Input
              label="Название страницы"
              value={settings.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Главная страница"
            />

            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">
                URL Slug
              </label>
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-gray-400" />
                <Input
                  value={settings.slug || ''}
                  onChange={(e) => handleChange('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="home"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                URL: /{settings.slug || 'home'}
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">
                Статус
              </label>
              <select
                value={settings.status || 'draft'}
                onChange={(e) => handleChange('status', e.target.value as PageSettings['status'])}
                className="w-full px-3 py-2 border border-gray-300 bg-white rounded text-sm text-gray-900"
              >
                <option value="draft">Черновик</option>
                <option value="published">Опубликовано</option>
                <option value="archived">Архив</option>
              </select>
            </div>
          </>
        )}

        {activeTab === 'seo' && (
          <>
            <Input
              label="Meta Title"
              value={settings.metaTitle || ''}
              onChange={(e) => handleChange('metaTitle', e.target.value)}
              placeholder="Заголовок страницы для поисковиков"
            />

            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">
                Meta Description
              </label>
              <textarea
                value={settings.metaDescription || ''}
                onChange={(e) => handleChange('metaDescription', e.target.value)}
                placeholder="Описание страницы (до 160 символов)"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 resize-none bg-white"
                rows={3}
                maxLength={160}
              />
              <p className="text-xs text-gray-500 mt-1">
                {settings.metaDescription?.length || 0} / 160
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">
                Keywords (через запятую)
              </label>
              <Input
                value={settings.keywords || ''}
                onChange={(e) => handleChange('keywords', e.target.value)}
                placeholder="ключевое, слово, список"
              />
            </div>

            <Input
              label="OG Image URL"
              value={settings.ogImage || ''}
              onChange={(e) => handleChange('ogImage', e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
          </>
        )}

        {activeTab === 'data' && (
          <PageSettingsDataTab
            pageId={pageId}
            settings={{
              dataSources: settings.dataSources || {
                dataSources: [],
                variables: {},
                cachePolicy: 'cache-first'
              },
              variables: settings.variables || { variables: [] }
            }}
            onChange={(dataSettings) => {
              onChange({
                ...settings,
                dataSources: dataSettings.dataSources,
                variables: dataSettings.variables
              })
            }}
          />
        )}
      </div>
    </>
  )
}
