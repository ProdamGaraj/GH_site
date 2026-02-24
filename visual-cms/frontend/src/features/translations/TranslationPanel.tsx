import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  fetchLanguages,
  fetchSourceContent,
  fetchPageTranslations,
  fetchTranslationProgress,
  saveTranslation,
  bulkSaveTranslations,
  setActiveLocale,
  selectLanguages,
  selectActiveLocale,
  selectSourceContent,
  selectSourceContentLoading,
  selectTranslationMap,
  selectTranslationsLoading,
  selectTranslationsSaving,
  selectTranslationProgress,
  selectNonDefaultLanguages,
  selectDefaultLanguage,
  updateTranslationLocally,
} from './translationsSlice'
import { selectRootNode, selectSelectedNode, setActiveRightPanel } from '@/features/editor/editorSlice'
import { Button } from '@/shared/components/Button'
import { 
  Globe, ChevronDown, Check, Search, Image, Type, Link, 
  FileText, Save, Loader2, X, Languages, ArrowRight,
  Eye, EyeOff, Settings
} from 'lucide-react'
import type { TranslationEntry } from '@/shared/types/translation'

interface TranslationPanelProps {
  pageId: string
}

type FieldCategory = 'all' | 'text' | 'media' | 'meta'

const FIELD_ICON: Record<string, React.ReactNode> = {
  content: <Type size={12} />,
  src: <Image size={12} />,
  alt: <FileText size={12} />,
  href: <Link size={12} />,
  placeholder: <Type size={12} />,
  title: <Type size={12} />,
  poster: <Image size={12} />,
  'aria-label': <FileText size={12} />,
  'meta:title': <FileText size={12} />,
  'meta:description': <FileText size={12} />,
  'meta:ogImage': <Image size={12} />,
}

const FIELD_LABEL: Record<string, string> = {
  content: 'Текст',
  src: 'Изображение/Видео',
  alt: 'Alt текст',
  href: 'Ссылка',
  placeholder: 'Placeholder',
  title: 'Title',
  poster: 'Poster',
  'aria-label': 'Aria Label',
  'meta:title': 'Meta Title',
  'meta:description': 'Meta Description',
  'meta:ogImage': 'OG Image',
}

function getFieldCategory(field: string): FieldCategory {
  if (field.startsWith('meta:')) return 'meta'
  if (['src', 'poster', 'meta:ogImage'].includes(field)) return 'media'
  return 'text'
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + '…'
}

export const TranslationPanel: React.FC<TranslationPanelProps> = ({ pageId }) => {
  const dispatch = useAppDispatch()
  
  const languages = useAppSelector(selectLanguages)
  const defaultLang = useAppSelector(selectDefaultLanguage)
  const nonDefaultLangs = useAppSelector(selectNonDefaultLanguages)
  const activeLocale = useAppSelector(selectActiveLocale)
  const sourceContent = useAppSelector(selectSourceContent)
  const sourceLoading = useAppSelector(selectSourceContentLoading)
  const translationMap = useAppSelector(selectTranslationMap)
  const translationsLoading = useAppSelector(selectTranslationsLoading)
  const saving = useAppSelector(selectTranslationsSaving)
  const progress = useAppSelector(selectTranslationProgress)
  const selectedNode = useAppSelector(selectSelectedNode)
  const rootNode = useAppSelector(selectRootNode)

  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<FieldCategory>('all')
  const [showOnlySelected, setShowOnlySelected] = useState(false)
  const [editedValues, setEditedValues] = useState<Record<string, string>>({})
  const [showLangDropdown, setShowLangDropdown] = useState(false)

  // Load languages and source content on mount
  useEffect(() => {
    dispatch(fetchLanguages())
  }, [dispatch])

  useEffect(() => {
    if (pageId) {
      dispatch(fetchSourceContent(pageId))
      dispatch(fetchTranslationProgress(pageId))
    }
  }, [dispatch, pageId])

  // Load translations when locale changes
  useEffect(() => {
    if (pageId && activeLocale) {
      dispatch(fetchPageTranslations({ pageId, locale: activeLocale }))
    }
  }, [dispatch, pageId, activeLocale])

  // Auto-select first non-default language
  useEffect(() => {
    if (!activeLocale && nonDefaultLangs.length > 0) {
      dispatch(setActiveLocale(nonDefaultLangs[0].code))
    }
  }, [dispatch, activeLocale, nonDefaultLangs])

  // Build a map of nodeId -> node name from the tree
  const nodeNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    map['__page__'] = 'Страница (мета)'
    
    const traverse = (node: any) => {
      if (!node) return
      if (node.id) {
        map[node.id] = node.metadata?.name || node.tagName || node.elementType || node.id.slice(0, 8)
      }
      if (node.children) node.children.forEach(traverse)
    }
    if (rootNode) traverse(rootNode)
    return map
  }, [rootNode])

  // Filter source content
  const filteredContent = useMemo(() => {
    let items = sourceContent

    if (filterCategory !== 'all') {
      items = items.filter(e => getFieldCategory(e.field) === filterCategory)
    }

    if (showOnlySelected && selectedNode) {
      items = items.filter(e => e.nodeId === selectedNode.id)
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(e =>
        e.value.toLowerCase().includes(q) ||
        (translationMap[e.nodeId]?.[e.field] || '').toLowerCase().includes(q) ||
        (nodeNameMap[e.nodeId] || '').toLowerCase().includes(q)
      )
    }

    return items
  }, [sourceContent, filterCategory, showOnlySelected, selectedNode, searchQuery, translationMap, nodeNameMap])

  // Group by nodeId
  const groupedContent = useMemo(() => {
    const groups: Record<string, TranslationEntry[]> = {}
    for (const entry of filteredContent) {
      if (!groups[entry.nodeId]) groups[entry.nodeId] = []
      groups[entry.nodeId].push(entry)
    }
    return groups
  }, [filteredContent])

  const handleEditValue = (nodeId: string, field: string, value: string) => {
    const key = `${nodeId}::${field}`
    setEditedValues(prev => ({ ...prev, [key]: value }))
    // Optimistic local update
    dispatch(updateTranslationLocally({ nodeId, field, value }))
  }

  const handleSaveOne = useCallback(async (nodeId: string, field: string) => {
    if (!activeLocale) return
    const key = `${nodeId}::${field}`
    const value = editedValues[key] ?? translationMap[nodeId]?.[field]
    if (value === undefined) return
    
    await dispatch(saveTranslation({
      pageId,
      locale: activeLocale,
      nodeId,
      field,
      value,
    }))
    
    // Remove from edited
    setEditedValues(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [dispatch, pageId, activeLocale, editedValues, translationMap])

  const handleSaveAll = async () => {
    if (!activeLocale) return
    const entries: TranslationEntry[] = []
    
    for (const [key, value] of Object.entries(editedValues)) {
      const [nodeId, field] = key.split('::')
      entries.push({ nodeId, field, value })
    }
    
    if (entries.length === 0) return
    
    await dispatch(bulkSaveTranslations({
      pageId,
      locale: activeLocale,
      translations: entries,
    }))
    
    setEditedValues({})
    dispatch(fetchTranslationProgress(pageId))
  }

  const currentProgress = progress.find(p => p.locale === activeLocale)
  const hasUnsaved = Object.keys(editedValues).length > 0
  const activeLang = languages.find(l => l.code === activeLocale)

  if (languages.length === 0 || nonDefaultLangs.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500 space-y-3">
        <Globe size={32} className="mx-auto text-gray-300" />
        <p>Для работы с переводами добавьте хотя бы два языка</p>
        <Button
          onClick={() => dispatch(setActiveRightPanel('languageSettings'))}
          className="mx-auto"
        >
          <Settings size={14} />
          Настройки языков
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header: Language Selector */}
      <div className="p-3 border-b border-gray-200 space-y-2">
        <div className="flex items-center gap-2">
          <Languages size={16} className="text-blue-600" />
          <span className="text-xs font-semibold text-gray-600 uppercase flex-1">Переводы</span>
          <button
            onClick={() => dispatch(setActiveRightPanel('languageSettings'))}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Настройки языков"
          >
            <Settings size={14} />
          </button>
        </div>
        
        {/* Language selector */}
        <div className="relative">
          <button
            onClick={() => setShowLangDropdown(!showLangDropdown)}
            className="w-full flex items-center justify-between p-2 border rounded hover:border-blue-400 transition-colors bg-white text-gray-900"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{activeLang?.flag || '🌐'}</span>
              <div className="text-left">
                <div className="text-sm font-medium text-gray-900">{activeLang?.nativeName || 'Выберите язык'}</div>
                {currentProgress && (
                  <div className="text-[10px] text-gray-400">
                    {currentProgress.translated}/{currentProgress.total} ({currentProgress.percentage}%)
                  </div>
                )}
              </div>
            </div>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          
          {showLangDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-50">
              {nonDefaultLangs.map(lang => {
                const p = progress.find(pr => pr.locale === lang.code)
                return (
                  <button
                    key={lang.code}
                    onClick={() => {
                      dispatch(setActiveLocale(lang.code))
                      setShowLangDropdown(false)
                      setEditedValues({})
                    }}
                    className={`w-full flex items-center gap-2 p-2 hover:bg-blue-50 transition-colors text-gray-900 ${
                      activeLocale === lang.code ? 'bg-blue-50' : ''
                    }`}
                  >
                    <span className="text-lg">{lang.flag || '🌐'}</span>
                    <div className="flex-1 text-left">
                      <div className="text-sm text-gray-900">{lang.nativeName}</div>
                      {p && (
                        <div className="flex items-center gap-1">
                          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${p.percentage}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400">{p.percentage}%</span>
                        </div>
                      )}
                    </div>
                    {activeLocale === lang.code && <Check size={14} className="text-blue-600" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Source language label */}
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <span>{defaultLang?.flag}</span>
          <span>Оригинал: {defaultLang?.nativeName}</span>
          <ArrowRight size={10} />
          <span>{activeLang?.flag}</span>
          <span>{activeLang?.nativeName}</span>
        </div>
      </div>

      {/* Toolbar: Search & Filters */}
      <div className="p-2 border-b border-gray-100 space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по тексту..."
            className="w-full pl-7 pr-2 py-1.5 text-xs border rounded focus:border-blue-400 focus:outline-none bg-white text-gray-900 placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
            >
              <X size={12} />
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-1 flex-wrap">
          {(['all', 'text', 'media', 'meta'] as FieldCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                filterCategory === cat
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
              }`}
            >
              {cat === 'all' ? 'Все' : cat === 'text' ? 'Тексты' : cat === 'media' ? 'Медиа' : 'Мета'}
            </button>
          ))}
          
          <button
            onClick={() => setShowOnlySelected(!showOnlySelected)}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ml-auto ${
              showOnlySelected && selectedNode
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'
            }`}
            title={showOnlySelected ? 'Показать все' : 'Только выбранный элемент'}
          >
            {showOnlySelected ? <Eye size={10} /> : <EyeOff size={10} />}
            <span className="ml-1">Выбранный</span>
          </button>
        </div>
      </div>

      {/* Content: Translation entries */}
      <div className="flex-1 overflow-y-auto">
        {(sourceLoading || translationsLoading) ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={16} className="animate-spin mr-2" />
            <span className="text-xs">Загрузка...</span>
          </div>
        ) : filteredContent.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
            {sourceContent.length === 0 ? 'Нет переводимого контента' : 'Ничего не найдено'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {Object.entries(groupedContent).map(([nodeId, entries]) => (
              <div key={nodeId} className="p-2">
                {/* Node header */}
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase truncate">
                    {nodeNameMap[nodeId] || nodeId.slice(0, 8)}
                  </span>
                  {nodeId !== '__page__' && (
                    <span className="text-[9px] text-gray-300 font-mono">{nodeId.slice(0, 8)}</span>
                  )}
                </div>
                
                {/* Fields */}
                <div className="space-y-2">
                  {entries.map((entry) => {
                    const key = `${nodeId}::${entry.field}`
                    const currentTranslation = editedValues[key] ?? translationMap[nodeId]?.[entry.field] ?? ''
                    const isEdited = key in editedValues
                    const isMediaField = ['src', 'poster', 'meta:ogImage'].includes(entry.field)
                    
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">{FIELD_ICON[entry.field] || <Type size={12} />}</span>
                          <span className="text-[10px] text-gray-500">{FIELD_LABEL[entry.field] || entry.field}</span>
                        </div>
                        
                        {/* Source (original) */}
                        <div className="text-[11px] text-gray-400 bg-gray-50 rounded px-2 py-1 break-words">
                          {isMediaField ? (
                            <div className="flex items-center gap-1">
                              <Image size={10} />
                              <span className="truncate">{truncate(entry.value, 60)}</span>
                            </div>
                          ) : (
                            truncate(entry.value, 120)
                          )}
                        </div>
                        
                        {/* Translation input */}
                        {isMediaField ? (
                          <input
                            type="text"
                            value={currentTranslation}
                            onChange={(e) => handleEditValue(nodeId, entry.field, e.target.value)}
                            onBlur={() => isEdited && handleSaveOne(nodeId, entry.field)}
                            placeholder={`URL ${FIELD_LABEL[entry.field]}...`}
                            className={`w-full text-xs border rounded px-2 py-1.5 focus:border-blue-400 focus:outline-none text-gray-900 placeholder-gray-400 ${
                              isEdited ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'
                            }`}
                          />
                        ) : entry.value.length > 80 ? (
                          <textarea
                            value={currentTranslation}
                            onChange={(e) => handleEditValue(nodeId, entry.field, e.target.value)}
                            onBlur={() => isEdited && handleSaveOne(nodeId, entry.field)}
                            placeholder="Введите перевод..."
                            rows={3}
                            className={`w-full text-xs border rounded px-2 py-1.5 focus:border-blue-400 focus:outline-none resize-none text-gray-900 placeholder-gray-400 ${
                              isEdited ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'
                            }`}
                          />
                        ) : (
                          <input
                            type="text"
                            value={currentTranslation}
                            onChange={(e) => handleEditValue(nodeId, entry.field, e.target.value)}
                            onBlur={() => isEdited && handleSaveOne(nodeId, entry.field)}
                            placeholder="Введите перевод..."
                            className={`w-full text-xs border rounded px-2 py-1.5 focus:border-blue-400 focus:outline-none text-gray-900 placeholder-gray-400 ${
                              isEdited ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'
                            }`}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Save all button */}
      {hasUnsaved && (
        <div className="p-2 border-t border-gray-200 bg-amber-50">
          <Button
            size="sm"
            className="w-full"
            onClick={handleSaveAll}
            disabled={saving}
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin mr-1" />
            ) : (
              <Save size={14} className="mr-1" />
            )}
            Сохранить все ({Object.keys(editedValues).length})
          </Button>
        </div>
      )}

      {/* Progress bar at bottom */}
      {currentProgress && (
        <div className="p-2 border-t border-gray-100">
          <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
            <span>Прогресс перевода</span>
            <span>{currentProgress.translated}/{currentProgress.total}</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                currentProgress.percentage === 100 ? 'bg-green-500' :
                currentProgress.percentage > 50 ? 'bg-blue-500' :
                currentProgress.percentage > 0 ? 'bg-amber-500' : 'bg-gray-300'
              }`}
              style={{ width: `${currentProgress.percentage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
