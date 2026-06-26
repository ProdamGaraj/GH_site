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
import { selectRootNode, selectSelectedNode, setActiveRightPanel, updateNode } from '@/features/editor/editorSlice'
import { Button } from '@/shared/components/Button'
import {
  Globe, ChevronDown, Check, Search, Image, Type, Link,
  FileText, Save, Loader2, X, Languages, ArrowRight,
  Eye, EyeOff, Settings, MousePointer, Trash2, Film
} from 'lucide-react'
import type { TranslationEntry } from '@/shared/types/translation'
import { MediaPicker } from '@/features/media/MediaPicker'
import type { MediaKind } from '@/shared/api/mediaApi'
import { pageApi } from '@/shared/api'

// --- Language Binding types ---
type LangRole = '' | 'lang-switch' | 'lang-selector' | 'lang-current' | 'lang-active'

const LANG_ROLES: { value: LangRole; label: string; description: string }[] = [
  { value: '', label: 'Нет роли', description: 'Элемент не участвует в переключении языка' },
  { value: 'lang-switch', label: 'Кнопка языка', description: 'Клик переключает на выбранный язык' },
  { value: 'lang-selector', label: 'Выпадающий список', description: 'Становится <select> со всеми языками' },
  { value: 'lang-current', label: 'Текущий язык', description: 'Показывает название/флаг текущего языка' },
  { value: 'lang-active', label: 'Индикатор активного', description: 'Виден только когда активен выбранный язык' },
]

const CURRENT_DISPLAY_OPTIONS = [
  { value: '', label: 'Название (по умолчанию)' },
  { value: 'flag', label: 'Флаг эмодзи' },
  { value: 'code', label: 'Код (en, ru, kz)' },
  { value: 'native', label: 'Родное название' },
]

function detectLangRole(attributes: Record<string, string> | undefined): {
  role: LangRole
  langCode: string
  displayFormat: string
} {
  if (!attributes) return { role: '', langCode: '', displayFormat: '' }
  
  if ('data-lang-switch' in attributes) {
    return { role: 'lang-switch', langCode: attributes['data-lang-switch'] || '', displayFormat: '' }
  }
  if ('data-lang-selector' in attributes) {
    return { role: 'lang-selector', langCode: '', displayFormat: '' }
  }
  if ('data-lang-current' in attributes) {
    return { role: 'lang-current', langCode: '', displayFormat: attributes['data-lang-current'] || '' }
  }
  if ('data-lang-active' in attributes) {
    return { role: 'lang-active', langCode: attributes['data-lang-active'] || '', displayFormat: '' }
  }
  
  return { role: '', langCode: '', displayFormat: '' }
}

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
  'bg:image': <Image size={12} />,
  'data-slide-video': <Film size={12} />,
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
  'bg:image': 'Фон (картинка)',
  'data-slide-video': 'Видео слайда',
  'meta:title': 'Meta Title',
  'meta:description': 'Meta Description',
  'meta:ogImage': 'OG Image',
}

const MEDIA_FIELDS = ['src', 'poster', 'meta:ogImage', 'bg:image', 'data-slide-video']

// Синтетические ключи медиа в page-переменных (repeat-слайдеры): nodeId="pagevar:<var>", field="media:<i>:<sf>".
const PAGEVAR_PREFIX = 'pagevar:'
const VAR_MEDIA_PREFIX = 'media:'

function getFieldCategory(field: string): FieldCategory {
  if (field.startsWith('meta:')) return 'meta'
  if (field.startsWith(VAR_MEDIA_PREFIX) || MEDIA_FIELDS.includes(field)) return 'media'
  return 'text'
}

/** Тип медиатеки для пикера по полю: видео-слайд/src/переменная — любой файл, остальное — картинка. */
function mediaKindForField(field: string): MediaKind | 'any' {
  if (field.startsWith(VAR_MEDIA_PREFIX) || field === 'data-slide-video' || field === 'src') return 'any'
  return 'image'
}

/** camelCase → "Camel Case" для подписи поля слайда. */
function humanizeField(sf: string): string {
  const spaced = sf.replace(/([a-z])([A-Z])/g, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Подпись медиа-поля: статичная из FIELD_LABEL либо «Слайд N · <поле>» для page-переменных. */
function fieldLabel(field: string): string {
  if (field.startsWith(VAR_MEDIA_PREFIX)) {
    const rest = field.slice(VAR_MEDIA_PREFIX.length)
    const colon = rest.indexOf(':')
    const idx = Number(rest.slice(0, colon))
    const sf = rest.slice(colon + 1)
    return `Слайд ${Number.isInteger(idx) ? idx + 1 : '?'} · ${humanizeField(sf)}`
  }
  return FIELD_LABEL[field] || field
}

/** Человекочитаемое имя узла: «Слайдер · <var>» для page-переменных, иначе из карты дерева. */
function nodeLabel(nodeId: string, nameMap: Record<string, string>): string {
  if (nodeId.startsWith(PAGEVAR_PREFIX)) return `Слайдер · ${nodeId.slice(PAGEVAR_PREFIX.length)}`
  return nameMap[nodeId] || nodeId.slice(0, 8)
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + '…'
}

// --- Language Binding Section Component ---
interface LanguageBindingSectionProps {
  selectedNode: { id: string; tagName?: string; metadata?: { name?: string }; attributes?: Record<string, string> }
  languages: Array<{ code: string; name: string; nativeName: string; flag?: string }>
  dispatch: ReturnType<typeof useAppDispatch>
}

const LanguageBindingSection: React.FC<LanguageBindingSectionProps> = ({
  selectedNode,
  languages,
  dispatch,
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  
  // Detect what's currently saved on the node
  const saved = useMemo(
    () => detectLangRole(selectedNode.attributes),
    [selectedNode.attributes]
  )

  // Local draft state — initialize from saved (key={selectedNode.id} on parent handles reset on node change)
  const [draftRole, setDraftRole] = useState<LangRole>(saved.role)
  const [draftLangCode, setDraftLangCode] = useState(saved.langCode)
  const [draftDisplayFormat, setDraftDisplayFormat] = useState(saved.displayFormat)

  const nodeName = selectedNode.metadata?.name || selectedNode.tagName || selectedNode.id.slice(0, 8)

  // Check if draft differs from saved
  const hasChanges = draftRole !== saved.role 
    || draftLangCode !== saved.langCode 
    || draftDisplayFormat !== saved.displayFormat

  const clearAllLangAttributes = useCallback((attrs: Record<string, string>) => {
    const cleaned = { ...attrs }
    delete cleaned['data-lang-switch']
    delete cleaned['data-lang-selector']
    delete cleaned['data-lang-current']
    delete cleaned['data-lang-active']
    return cleaned
  }, [])

  // When role changes in the dropdown, update draft + set sensible defaults
  const handleDraftRoleChange = useCallback((newRole: LangRole) => {
    setDraftRole(newRole)
    if (newRole === 'lang-switch' || newRole === 'lang-active') {
      setDraftLangCode(prev => prev || languages[0]?.code || 'en')
      setDraftDisplayFormat('')
    } else if (newRole === 'lang-current') {
      setDraftLangCode('')
      setDraftDisplayFormat('')
    } else {
      setDraftLangCode('')
      setDraftDisplayFormat('')
    }
  }, [languages])

  // Apply draft to the node
  const handleApply = useCallback(() => {
    const baseAttrs = clearAllLangAttributes(selectedNode.attributes || {})
    
    let newAttrs: Record<string, string>
    switch (draftRole) {
      case 'lang-switch':
        newAttrs = { ...baseAttrs, 'data-lang-switch': draftLangCode || languages[0]?.code || 'en' }
        break
      case 'lang-selector':
        newAttrs = { ...baseAttrs, 'data-lang-selector': '' }
        break
      case 'lang-current':
        newAttrs = { ...baseAttrs, 'data-lang-current': draftDisplayFormat }
        break
      case 'lang-active':
        newAttrs = { ...baseAttrs, 'data-lang-active': draftLangCode || languages[0]?.code || 'en' }
        break
      default:
        newAttrs = baseAttrs
    }
    
    dispatch(updateNode({ id: selectedNode.id, updates: { attributes: newAttrs } }))
  }, [dispatch, selectedNode.id, selectedNode.attributes, draftRole, draftLangCode, draftDisplayFormat, languages, clearAllLangAttributes])

  const handleRemoveBinding = useCallback(() => {
    const baseAttrs = clearAllLangAttributes(selectedNode.attributes || {})
    dispatch(updateNode({ id: selectedNode.id, updates: { attributes: baseAttrs } }))
    setDraftRole('')
    setDraftLangCode('')
    setDraftDisplayFormat('')
  }, [dispatch, selectedNode.id, selectedNode.attributes, clearAllLangAttributes])

  return (
    <div className="border-b border-gray-200">
      {/* Section header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 transition-colors"
      >
        <MousePointer size={12} className="text-purple-500" />
        <span className="text-[10px] font-semibold text-gray-600 uppercase flex-1 text-left">
          Привязка языка
        </span>
        <span className="text-[10px] text-gray-400 truncate max-w-[100px]">
          {nodeName}
        </span>
        <ChevronDown
          size={12}
          className={`text-gray-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
        />
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Current saved assignment indicator */}
          {saved.role && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 rounded text-[10px] text-purple-700">
              <Check size={10} />
              <span className="flex-1">
                {LANG_ROLES.find(r => r.value === saved.role)?.label}
                {saved.langCode && ` → ${saved.langCode}`}
                {saved.displayFormat && ` (${CURRENT_DISPLAY_OPTIONS.find(o => o.value === saved.displayFormat)?.label || saved.displayFormat})`}
              </span>
              <button
                onClick={handleRemoveBinding}
                className="p-0.5 rounded hover:bg-purple-100 text-purple-400 hover:text-purple-600 transition-colors"
                title="Удалить привязку"
              >
                <Trash2 size={10} />
              </button>
            </div>
          )}

          {/* Role selector */}
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">Роль элемента</label>
            <select
              value={draftRole}
              onChange={(e) => handleDraftRoleChange(e.target.value as LangRole)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-blue-400 focus:outline-none bg-white text-gray-900"
            >
              {LANG_ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <p className="text-[9px] text-gray-400 mt-0.5">
              {LANG_ROLES.find(r => r.value === draftRole)?.description}
            </p>
          </div>

          {/* Language code selector — for lang-switch and lang-active */}
          {(draftRole === 'lang-switch' || draftRole === 'lang-active') && (
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">
                {draftRole === 'lang-switch' ? 'Переключить на язык' : 'Показывать для языка'}
              </label>
              <div className="flex flex-wrap gap-1">
                {languages.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => setDraftLangCode(lang.code)}
                    className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border transition-colors ${
                      draftLangCode === lang.code
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <span>{lang.flag || '🌐'}</span>
                    <span>{lang.code}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Display format — for lang-current */}
          {draftRole === 'lang-current' && (
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">Формат отображения</label>
              <select
                value={draftDisplayFormat}
                onChange={(e) => setDraftDisplayFormat(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-blue-400 focus:outline-none bg-white text-gray-900"
              >
                {CURRENT_DISPLAY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Apply button — visible when draft differs from saved */}
          {hasChanges && (
            <button
              onClick={handleApply}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 transition-colors"
            >
              <Check size={14} />
              Применить
            </button>
          )}
        </div>
      )}
    </div>
  )
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
  // Сайт страницы — для скоупа медиатеки в пикере.
  const [siteId, setSiteId] = useState<string | null>(null)
  // Контекст пикера: какое медиа-поле какого узла выбираем для текущего языка.
  const [pickerCtx, setPickerCtx] = useState<{ nodeId: string; field: string } | null>(null)

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

  // Подтягиваем siteId страницы для пикера медиатеки.
  useEffect(() => {
    if (!pageId) return
    let cancelled = false
    pageApi
      .getById(pageId)
      .then((p) => {
        if (!cancelled) setSiteId((p as { siteId?: string | null }).siteId ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [pageId])

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
        nodeLabel(e.nodeId, nodeNameMap).toLowerCase().includes(q)
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

  // Выбор медиа из пикера: сразу сохраняем перевод (URL ассета) и снимаем «грязный» флаг поля.
  const handlePickMedia = (nodeId: string, field: string, url: string) => {
    if (!activeLocale) return
    dispatch(updateTranslationLocally({ nodeId, field, value: url }))
    dispatch(saveTranslation({ pageId, locale: activeLocale, nodeId, field, value: url }))
    setEditedValues(prev => {
      const next = { ...prev }
      delete next[`${nodeId}::${field}`]
      return next
    })
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

      {/* Language Binding Section — assign data-lang-* attributes to selected element */}
      <div className="border-b border-gray-200">
        {selectedNode ? (
          <LanguageBindingSection
            key={selectedNode.id}
            selectedNode={selectedNode}
            languages={languages}
            dispatch={dispatch}
          />
        ) : (
          <div className="p-2">
            <div className="flex items-center gap-2 mb-1">
              <MousePointer size={12} className="text-purple-500" />
              <span className="text-[10px] font-semibold text-gray-600 uppercase">
                Привязка языка
              </span>
            </div>
            <p className="text-[10px] text-gray-400 pl-5">
              Выберите элемент на странице, чтобы назначить ему роль переключателя языка
            </p>
          </div>
        )}
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
                    {nodeLabel(nodeId, nodeNameMap)}
                  </span>
                  {nodeId !== '__page__' && !nodeId.startsWith(PAGEVAR_PREFIX) && (
                    <span className="text-[9px] text-gray-300 font-mono">{nodeId.slice(0, 8)}</span>
                  )}
                </div>
                
                {/* Fields */}
                <div className="space-y-2">
                  {entries.map((entry) => {
                    const key = `${nodeId}::${entry.field}`
                    const currentTranslation = editedValues[key] ?? translationMap[nodeId]?.[entry.field] ?? ''
                    const isEdited = key in editedValues
                    const isMediaField = getFieldCategory(entry.field) === 'media'
                    
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">
                            {FIELD_ICON[entry.field] || (isMediaField ? <Image size={12} /> : <Type size={12} />)}
                          </span>
                          <span className="text-[10px] text-gray-500">{fieldLabel(entry.field)}</span>
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
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={currentTranslation}
                              onChange={(e) => handleEditValue(nodeId, entry.field, e.target.value)}
                              onBlur={() => isEdited && handleSaveOne(nodeId, entry.field)}
                              placeholder={`URL ${fieldLabel(entry.field)}...`}
                              className={`flex-1 min-w-0 text-xs border rounded px-2 py-1.5 focus:border-blue-400 focus:outline-none text-gray-900 placeholder-gray-400 ${
                                isEdited ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => setPickerCtx({ nodeId, field: entry.field })}
                              title="Выбрать из медиатеки"
                              className="shrink-0 p-1.5 rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 hover:text-blue-600 transition-colors"
                            >
                              <Image size={14} />
                            </button>
                          </div>
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

      {/* Пикер медиатеки для медиа-полей перевода (src/poster/og:image/фон/видео-слайда) */}
      <MediaPicker
        open={pickerCtx !== null}
        kind={pickerCtx ? mediaKindForField(pickerCtx.field) : 'any'}
        siteId={siteId}
        title="Выберите файл для языка"
        onClose={() => setPickerCtx(null)}
        onSelect={(asset) => {
          if (pickerCtx) handlePickMedia(pickerCtx.nodeId, pickerCtx.field, asset.url)
          setPickerCtx(null)
        }}
      />
    </div>
  )
}
