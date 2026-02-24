import React, { useState, useEffect } from 'react'
import { Header } from '@/shared/components/Header'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { 
  selectBrowsers, 
  selectStandardMonitors, 
  selectBreakpoints,
  addBrowser, 
  removeBrowser, 
  updateBrowser,
  addStandardMonitor,
  removeStandardMonitor,
  addBreakpoint,
  removeBreakpoint,
  updateBreakpoint
} from '@/features/editor/editorSlice'
import {
  fetchLanguages,
  createLanguage,
  updateLanguage,
  deleteLanguage,
  seedDefaultLanguages,
  selectLanguages,
  selectLanguagesLoading,
} from '@/features/translations/translationsSlice'
import { Browser, StandardMonitor } from '@/shared/types'
import type { Language, CreateLanguageRequest } from '@/shared/types/translation'
import { Plus, Trash2, Monitor, Laptop, Tablet, Smartphone, Watch, Check, X, Globe, Star, AlertTriangle } from 'lucide-react'
import { Button } from '@/shared/components/Button'

const COMMON_LANGUAGES: Array<{ code: string; name: string; nativeName: string; flag: string }> = [
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'kz', name: 'Kazakh', nativeName: 'Қазақша', flag: '🇰🇿' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
]

export const Settings: React.FC = () => {
  const dispatch = useAppDispatch()
  const browsers = useAppSelector(selectBrowsers)
  const standardMonitors = useAppSelector(selectStandardMonitors)
  const breakpoints = useAppSelector(selectBreakpoints)

  // Languages
  const languages = useAppSelector(selectLanguages)
  const languagesLoading = useAppSelector(selectLanguagesLoading)

  // Edit state for browsers
  const [editingBrowser, setEditingBrowser] = useState<string | null>(null)
  const [editBrowserData, setEditBrowserData] = useState<Partial<Browser>>({})

  // Edit state for viewports
  const [editingViewport, setEditingViewport] = useState<string | null>(null)
  const [editViewportData, setEditViewportData] = useState<Partial<{
    id: string
    name: string
    width: number
    height?: number
    browserId?: string
    icon: 'monitor' | 'tablet' | 'smartphone' | 'laptop' | 'watch'
    color: string
  }>>({})

  // Language state
  const [showLangForm, setShowLangForm] = useState(false)
  const [newLang, setNewLang] = useState<CreateLanguageRequest>({
    code: '', name: '', nativeName: '', flag: '', direction: 'ltr',
  })
  const [deleteLangConfirm, setDeleteLangConfirm] = useState<string | null>(null)

  useEffect(() => {
    dispatch(fetchLanguages())
  }, [dispatch])

  // Browser form state
  const [newBrowser, setNewBrowser] = useState<Partial<Browser>>({
    name: '',
    viewportHeightOffset: 0,
    icon: '🌐',
    isDefault: false
  })

  // Monitor form state
  const [newMonitor, setNewMonitor] = useState<Partial<StandardMonitor>>({
    name: '',
    width: 0,
    height: 0,
    icon: '🖥️'
  })

  // Viewport form state
  const [newViewport, setNewViewport] = useState<{
    name: string
    width: string
    height: string
    icon: 'monitor' | 'tablet' | 'smartphone' | 'laptop' | 'watch'
    color: string
  }>({
    name: '',
    width: '',
    height: '',
    icon: 'monitor',
    color: '#3b82f6'
  })

  const handleAddBrowser = () => {
    if (newBrowser.name && newBrowser.viewportHeightOffset !== undefined) {
      dispatch(addBrowser({
        id: `browser-${Date.now()}`,
        name: newBrowser.name,
        viewportHeightOffset: newBrowser.viewportHeightOffset,
        icon: newBrowser.icon || '🌐',
        isDefault: newBrowser.isDefault || false
      }))
      setNewBrowser({ name: '', viewportHeightOffset: 0, icon: '🌐', isDefault: false })
    }
  }

  const handleAddMonitor = () => {
    if (newMonitor.name && newMonitor.width && newMonitor.height) {
      dispatch(addStandardMonitor({
        id: `monitor-${Date.now()}`,
        name: newMonitor.name,
        width: newMonitor.width,
        height: newMonitor.height,
        icon: newMonitor.icon || '🖥️'
      }))
      setNewMonitor({ name: '', width: 0, height: 0, icon: '🖥️' })
    }
  }

  const handleAddViewport = () => {
    if (newViewport.name && newViewport.width) {
      dispatch(addBreakpoint({
        id: `custom-${Date.now()}`,
        name: newViewport.name,
        width: Number(newViewport.width),
        height: newViewport.height ? Number(newViewport.height) : undefined,
        icon: newViewport.icon,
        color: newViewport.color
      }))
      setNewViewport({ name: '', width: '', height: '', icon: 'monitor', color: '#3b82f6' })
    }
  }

  const handleEditBrowser = (browser: Browser) => {
    setEditingBrowser(browser.id)
    setEditBrowserData(browser)
  }

  const handleSaveBrowser = () => {
    if (editingBrowser && editBrowserData.id) {
      dispatch(updateBrowser(editBrowserData as Browser))
      setEditingBrowser(null)
      setEditBrowserData({})
    }
  }

  const handleEditViewport = (bp: any) => {
    setEditingViewport(bp.id)
    setEditViewportData(bp)
  }

  const handleSaveViewport = () => {
    if (editingViewport && editViewportData.id && editViewportData.name && editViewportData.width && editViewportData.icon && editViewportData.color) {
      dispatch(updateBreakpoint({
        id: editViewportData.id,
        name: editViewportData.name,
        width: editViewportData.width,
        height: editViewportData.height,
        browserId: editViewportData.browserId,
        icon: editViewportData.icon,
        color: editViewportData.color
      }))
      setEditingViewport(null)
      setEditViewportData({})
    }
  }

  // Language handlers
  const handleSelectCommonLang = (common: typeof COMMON_LANGUAGES[0]) => {
    setNewLang({
      code: common.code,
      name: common.name,
      nativeName: common.nativeName,
      flag: common.flag,
      direction: common.code === 'ar' ? 'rtl' : 'ltr',
    })
  }

  const handleAddLanguage = async () => {
    if (!newLang.code || !newLang.name || !newLang.nativeName) return
    await dispatch(createLanguage(newLang))
    setNewLang({ code: '', name: '', nativeName: '', flag: '', direction: 'ltr' })
    setShowLangForm(false)
  }

  const handleToggleLangActive = (lang: Language) => {
    dispatch(updateLanguage({ id: lang.id, data: { isActive: !lang.isActive } }))
  }

  const handleSetDefaultLang = (lang: Language) => {
    if (lang.isDefault) return
    dispatch(updateLanguage({ id: lang.id, data: { isDefault: true } }))
  }

  const handleDeleteLang = (id: string) => {
    dispatch(deleteLanguage(id))
    setDeleteLangConfirm(null)
  }

  const existingLangCodes = languages.map(l => l.code)
  const availableCommonLangs = COMMON_LANGUAGES.filter(cl => !existingLangCodes.includes(cl.code))

  const iconOptions = [
    { value: 'monitor' as const, Icon: Monitor, label: 'Monitor' },
    { value: 'laptop' as const, Icon: Laptop, label: 'Laptop' },
    { value: 'tablet' as const, Icon: Tablet, label: 'Tablet' },
    { value: 'smartphone' as const, Icon: Smartphone, label: 'Smartphone' },
    { value: 'watch' as const, Icon: Watch, label: 'Watch' },
  ]

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Настройки
            </h1>
            <p className="text-gray-600">
              Управление языками, браузерами, мониторами и viewports
            </p>
          </header>

          <div className="space-y-6">
            {/* Languages Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Globe size={20} className="text-blue-600" />
                Языки сайта
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Настройка языков для переводов контента. Основной язык — это язык, на котором создаётся контент в редакторе. Переводы выполняются на все остальные языки.
              </p>

              {/* Language List */}
              {languages.length === 0 && !languagesLoading ? (
                <div className="text-center py-6 space-y-3">
                  <Globe size={32} className="mx-auto text-gray-300" />
                  <p className="text-sm text-gray-500">Языки не настроены</p>
                  <Button onClick={() => dispatch(seedDefaultLanguages())}>
                    <Globe size={16} className="mr-2" />
                    Добавить RU + EN
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {languages.map((lang) => (
                    <div
                      key={lang.id}
                      className={`flex items-center gap-3 p-3 rounded border ${
                        lang.isActive 
                          ? 'border-gray-200 bg-gray-50' 
                          : 'border-gray-100 bg-gray-50 opacity-50'
                      }`}
                    >
                      <span className="text-2xl">{lang.flag || '🌐'}</span>
                      
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {lang.nativeName}
                          <span className="text-gray-400 text-sm ml-2">({lang.code})</span>
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          {lang.name}
                          {lang.direction === 'rtl' && (
                            <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">RTL</span>
                          )}
                        </div>
                      </div>

                      {lang.isDefault ? (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded flex items-center gap-1">
                          <Star size={12} fill="currentColor" />
                          Основной
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSetDefaultLang(lang)}
                          className="p-1 hover:bg-amber-50 rounded text-gray-400 hover:text-amber-500"
                          title="Сделать основным"
                        >
                          <Star size={16} />
                        </button>
                      )}

                      <button
                        onClick={() => handleToggleLangActive(lang)}
                        className={`p-1 rounded ${
                          lang.isActive 
                            ? 'text-green-600 hover:text-green-700 hover:bg-green-50' 
                            : 'text-gray-400 hover:text-green-500 hover:bg-green-50'
                        }`}
                        title={lang.isActive ? 'Деактивировать' : 'Активировать'}
                      >
                        <Check size={16} />
                      </button>

                      {!lang.isDefault && (
                        deleteLangConfirm === lang.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteLang(lang.id)}
                              className="p-1 bg-red-600 text-white rounded hover:bg-red-700"
                              title="Подтвердить удаление"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteLangConfirm(null)}
                              className="p-1 bg-gray-400 text-white rounded hover:bg-gray-500"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteLangConfirm(lang.id)}
                            className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-600"
                            title="Удалить"
                          >
                            <Trash2 size={16} />
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add Language Form */}
              <div className="border-t pt-4 space-y-3">
                {showLangForm ? (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Добавить язык</h4>
                    
                    {/* Quick select */}
                    {availableCommonLangs.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Быстрый выбор</label>
                        <div className="flex flex-wrap gap-2">
                          {availableCommonLangs.map((cl) => (
                            <button
                              key={cl.code}
                              onClick={() => handleSelectCommonLang(cl)}
                              className={`text-sm px-3 py-1.5 rounded border transition-colors ${
                                newLang.code === cl.code
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-gray-900 border-gray-200 hover:border-blue-300'
                              }`}
                            >
                              {cl.flag} {cl.nativeName}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-5 gap-3">
                      <input
                        type="text"
                        placeholder="Код (en)"
                        value={newLang.code}
                        onChange={(e) => setNewLang({ ...newLang, code: e.target.value })}
                        className="px-3 py-2 bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Название (English)"
                        value={newLang.name}
                        onChange={(e) => setNewLang({ ...newLang, name: e.target.value })}
                        className="px-3 py-2 bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Родное название"
                        value={newLang.nativeName}
                        onChange={(e) => setNewLang({ ...newLang, nativeName: e.target.value })}
                        className="px-3 py-2 bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Флаг (🇬🇧)"
                        value={newLang.flag || ''}
                        onChange={(e) => setNewLang({ ...newLang, flag: e.target.value })}
                        className="px-3 py-2 bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <select
                        value={newLang.direction}
                        onChange={(e) => setNewLang({ ...newLang, direction: e.target.value as 'ltr' | 'rtl' })}
                        className="px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="ltr">LTR (слева направо)</option>
                        <option value="rtl">RTL (справа налево)</option>
                      </select>
                    </div>

                    <div className="flex gap-3">
                      <Button onClick={handleAddLanguage} disabled={!newLang.code || !newLang.name || !newLang.nativeName}>
                        <Plus size={16} className="mr-2" />
                        Добавить
                      </Button>
                      <Button variant="secondary" onClick={() => { setShowLangForm(false); setNewLang({ code: '', name: '', nativeName: '', flag: '', direction: 'ltr' }) }}>
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button onClick={() => setShowLangForm(true)}>
                      <Plus size={16} className="mr-2" />
                      Добавить язык
                    </Button>
                    {languages.length === 0 && (
                      <Button variant="secondary" onClick={() => dispatch(seedDefaultLanguages())}>
                        <Globe size={16} className="mr-2" />
                        Добавить RU + EN
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Info about languages */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <AlertTriangle size={14} />
                О языках и переводах
              </h4>
              <p className="text-sm text-blue-800 mb-1">
                <strong>Основной язык</strong> (⭐) — язык, на котором создаётся контент в редакторе.
              </p>
              <p className="text-sm text-blue-800 mb-1">
                <strong>Переводы</strong> делаются из основного языка во все остальные через панель «Переводы» в редакторе.
              </p>
              <p className="text-sm text-blue-800">
                При публикации страницы для каждого языка создаётся отдельная HTML-версия (напр. <code className="bg-blue-100 px-1 rounded">/en/page.html</code>).
              </p>
            </div>

            {/* Browsers Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Браузеры и Browser Offset</h3>
              <p className="text-sm text-gray-600 mb-4">
                Настройка высоты UI браузера (адресная строка, вкладки, панели). Используется для точного расчёта vh-единиц.
              </p>
              
              {/* Browsers List */}
              <div className="space-y-2 mb-4">
                {browsers.map(browser => (
                  <div key={browser.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                    {editingBrowser === browser.id ? (
                      <>
                        <input
                          type="text"
                          value={editBrowserData.icon || ''}
                          onChange={(e) => setEditBrowserData({ ...editBrowserData, icon: e.target.value })}
                          className="w-12 px-2 py-1 text-center border border-gray-300 rounded"
                        />
                        <input
                          type="text"
                          value={editBrowserData.name || ''}
                          onChange={(e) => setEditBrowserData({ ...editBrowserData, name: e.target.value })}
                          className="flex-1 px-3 py-1 border border-gray-300 rounded"
                        />
                        <input
                          type="number"
                          value={editBrowserData.viewportHeightOffset || 0}
                          onChange={(e) => setEditBrowserData({ ...editBrowserData, viewportHeightOffset: Number(e.target.value) })}
                          className="w-24 px-3 py-1 border border-gray-300 rounded"
                        />
                        <button
                          onClick={handleSaveBrowser}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => { setEditingBrowser(null); setEditBrowserData({}) }}
                          className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl">{browser.icon}</span>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{browser.name}</div>
                          <div className="text-sm text-gray-500">Offset: {browser.viewportHeightOffset}px</div>
                        </div>
                        {browser.isDefault && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">По умолчанию</span>
                        )}
                        <button
                          onClick={() => handleEditBrowser(browser)}
                          className="p-1 hover:bg-blue-50 rounded text-blue-600"
                        >
                          ✏️
                        </button>
                        {!browser.isDefault && (
                          <button
                            onClick={() => dispatch(removeBrowser(browser.id))}
                            className="p-1 hover:bg-red-50 rounded text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Browser Form */}
              <div className="border-t pt-4 space-y-3">
                <h4 className="font-medium text-gray-900">Добавить браузер</h4>
                <div className="grid grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="Название"
                    value={newBrowser.name}
                    onChange={(e) => setNewBrowser({ ...newBrowser, name: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <input
                    type="number"
                    placeholder="Offset (px)"
                    value={newBrowser.viewportHeightOffset || ''}
                    onChange={(e) => setNewBrowser({ ...newBrowser, viewportHeightOffset: Number(e.target.value) })}
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <input
                    type="text"
                    placeholder="Иконка (emoji)"
                    value={newBrowser.icon}
                    onChange={(e) => setNewBrowser({ ...newBrowser, icon: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <Button onClick={handleAddBrowser}>
                    <Plus size={16} className="mr-2" />
                    Добавить
                  </Button>
                </div>
              </div>
            </div>

            {/* Standard Monitors Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Стандартные мониторы</h3>
              <p className="text-sm text-gray-600 mb-4">
                Предустановленные разрешения экранов для быстрого создания viewports.
              </p>
              
              {/* Monitors Grid */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {standardMonitors.map(monitor => (
                  <div key={monitor.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded border">
                    <span className="text-xl">{monitor.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{monitor.name}</div>
                      <div className="text-sm text-gray-500">{monitor.width}×{monitor.height}</div>
                    </div>
                    <button
                      onClick={() => dispatch(removeStandardMonitor(monitor.id))}
                      className="p-1 hover:bg-red-50 rounded text-red-600 flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Monitor Form */}
              <div className="border-t pt-4 space-y-3">
                <h4 className="font-medium text-gray-900">Добавить монитор</h4>
                <div className="grid grid-cols-5 gap-3">
                  <input
                    type="text"
                    placeholder="Название"
                    value={newMonitor.name}
                    onChange={(e) => setNewMonitor({ ...newMonitor, name: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <input
                    type="number"
                    placeholder="Ширина"
                    value={newMonitor.width || ''}
                    onChange={(e) => setNewMonitor({ ...newMonitor, width: Number(e.target.value) })}
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <input
                    type="number"
                    placeholder="Высота"
                    value={newMonitor.height || ''}
                    onChange={(e) => setNewMonitor({ ...newMonitor, height: Number(e.target.value) })}
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <input
                    type="text"
                    placeholder="Иконка"
                    value={newMonitor.icon}
                    onChange={(e) => setNewMonitor({ ...newMonitor, icon: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <Button onClick={handleAddMonitor}>
                    <Plus size={16} className="mr-2" />
                    Добавить
                  </Button>
                </div>
              </div>
            </div>

            {/* Custom Viewports Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Пользовательские Viewports</h3>
              <p className="text-sm text-gray-600 mb-4">
                Создание собственных breakpoints для responsive режима редактора.
              </p>
              
              {/* Viewports List */}
              <div className="space-y-2 mb-4">
                {breakpoints.map(bp => {
                  const iconOption = iconOptions.find(opt => opt.value === bp.icon) || iconOptions[0]
                  const Icon = iconOption.Icon
                  const isDefault = ['desktop-hd', 'desktop-fhd', 'tablet', 'mobile'].includes(bp.id)
                  
                  return (
                    <div key={bp.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                      {editingViewport === bp.id ? (
                        <>
                          <select
                            value={editViewportData.icon || 'monitor'}
                            onChange={(e) => setEditViewportData({ ...editViewportData, icon: e.target.value as 'monitor' | 'tablet' | 'smartphone' | 'laptop' | 'watch' })}
                            className="px-2 py-1 border border-gray-300 rounded"
                          >
                            {iconOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={editViewportData.name || ''}
                            onChange={(e) => setEditViewportData({ ...editViewportData, name: e.target.value })}
                            className="flex-1 px-3 py-1 border border-gray-300 rounded"
                          />
                          <input
                            type="number"
                            value={editViewportData.width || ''}
                            onChange={(e) => setEditViewportData({ ...editViewportData, width: Number(e.target.value) })}
                            className="w-24 px-3 py-1 border border-gray-300 rounded"
                            placeholder="Width"
                          />
                          <input
                            type="number"
                            value={editViewportData.height || ''}
                            onChange={(e) => setEditViewportData({ ...editViewportData, height: Number(e.target.value) || undefined })}
                            className="w-24 px-3 py-1 border border-gray-300 rounded"
                            placeholder="Height"
                          />
                          <input
                            type="color"
                            value={editViewportData.color || '#3b82f6'}
                            onChange={(e) => setEditViewportData({ ...editViewportData, color: e.target.value })}
                            className="w-12 h-8 border rounded cursor-pointer"
                          />
                          <button
                            onClick={handleSaveViewport}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => { setEditingViewport(null); setEditViewportData({}) }}
                            className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <Icon size={20} className="text-gray-600" />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{bp.name}</div>
                            <div className="text-sm text-gray-500">
                              {bp.width}px{bp.height ? ` × ${bp.height}px` : ''}
                            </div>
                          </div>
                          <div 
                            className="w-6 h-6 rounded border"
                            style={{ backgroundColor: bp.color }}
                          />
                          {isDefault && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Системный</span>
                          )}
                          <button
                            onClick={() => handleEditViewport(bp)}
                            className="p-1 hover:bg-blue-50 rounded text-blue-600"
                          >
                            ✏️
                          </button>
                          {!isDefault && (
                            <button
                              onClick={() => dispatch(removeBreakpoint(bp.id))}
                              className="p-1 hover:bg-red-50 rounded text-red-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Add Viewport Form */}
              <div className="border-t pt-4 space-y-3">
                <h4 className="font-medium text-gray-900">Добавить viewport</h4>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Название"
                    value={newViewport.name}
                    onChange={(e) => setNewViewport({ ...newViewport, name: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <input
                    type="number"
                    placeholder="Ширина (px)"
                    value={newViewport.width}
                    onChange={(e) => setNewViewport({ ...newViewport, width: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <input
                    type="number"
                    placeholder="Высота (px)"
                    value={newViewport.height}
                    onChange={(e) => setNewViewport({ ...newViewport, height: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex gap-3 items-center">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Иконка</label>
                    <div className="flex gap-2">
                      {iconOptions.map(({ value, Icon, label }) => (
                        <button
                          key={value}
                          onClick={() => setNewViewport({ ...newViewport, icon: value })}
                          className={`p-3 border rounded hover:border-primary-500 transition-colors ${
                            newViewport.icon === value ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
                          }`}
                          title={label}
                        >
                          <Icon size={20} className={newViewport.icon === value ? 'text-primary-600' : 'text-gray-600'} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Цвет</label>
                    <input
                      type="color"
                      value={newViewport.color}
                      onChange={(e) => setNewViewport({ ...newViewport, color: e.target.value })}
                      className="h-11 w-20 border rounded cursor-pointer"
                    />
                  </div>
                  <div className="self-end">
                    <Button onClick={handleAddViewport}>
                      <Plus size={16} className="mr-2" />
                      Добавить Viewport
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Default viewports info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">ℹ️ Системные viewports</h4>
              <p className="text-sm text-blue-800 mb-2">
                Desktop HD, Desktop FHD, Tablet и Mobile являются системными viewports и не могут быть удалены.
              </p>
              <p className="text-sm text-blue-800">
                Вы можете создавать дополнительные viewports или изменять параметры системных (ширина, высота, цвет) 
                через BreakpointManager в редакторе (кнопка ⚙️ рядом с переключателем viewports).
              </p>
            </div>

            {/* Info about editing defaults */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-medium text-amber-900 mb-2">💡 Редактирование настроек</h4>
              <p className="text-sm text-amber-800">
                <strong>Браузеры:</strong> Все браузеры можно редактировать (✏️), системные нельзя удалить.<br/>
                <strong>Мониторы:</strong> Все можно редактировать и удалять. Используются как пресеты для быстрого создания viewports.<br/>
                <strong>Viewports:</strong> Все можно редактировать (✏️), системные (Desktop HD/FHD, Tablet, Mobile) нельзя удалить.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
