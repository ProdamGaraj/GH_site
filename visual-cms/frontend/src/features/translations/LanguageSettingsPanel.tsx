import React, { useState, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  fetchLanguages,
  createLanguage,
  updateLanguage,
  deleteLanguage,
  seedDefaultLanguages,
  selectLanguages,
  selectLanguagesLoading,
} from './translationsSlice'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { Plus, Trash2, Star, GripVertical, Globe, X, Check, AlertTriangle } from 'lucide-react'
import type { Language, CreateLanguageRequest } from '@/shared/types/translation'

interface LanguageSettingsPanelProps {
  onClose?: () => void
}

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

export const LanguageSettingsPanel: React.FC<LanguageSettingsPanelProps> = ({ onClose }) => {
  const dispatch = useAppDispatch()
  const languages = useAppSelector(selectLanguages)
  const loading = useAppSelector(selectLanguagesLoading)
  
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLang, setNewLang] = useState<CreateLanguageRequest>({
    code: '',
    name: '',
    nativeName: '',
    flag: '',
    direction: 'ltr',
  })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  
  useEffect(() => {
    dispatch(fetchLanguages())
  }, [dispatch])

  const handleSeedDefaults = () => {
    dispatch(seedDefaultLanguages())
  }

  const handleSelectCommon = (common: typeof COMMON_LANGUAGES[0]) => {
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
    setShowAddForm(false)
  }

  const handleToggleActive = (lang: Language) => {
    dispatch(updateLanguage({
      id: lang.id,
      data: { isActive: !lang.isActive },
    }))
  }

  const handleSetDefault = (lang: Language) => {
    if (lang.isDefault) return
    dispatch(updateLanguage({
      id: lang.id,
      data: { isDefault: true },
    }))
  }

  const handleDelete = (id: string) => {
    dispatch(deleteLanguage(id))
    setDeleteConfirm(null)
  }

  const existingCodes = languages.map(l => l.code)
  const availableCommon = COMMON_LANGUAGES.filter(cl => !existingCodes.includes(cl.code))

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Globe size={16} />
          Языки сайта
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Language List */ }
      {languages.length === 0 && !loading ? (
        <div className="text-center py-6 space-y-3">
          <p className="text-sm text-gray-500">Языки не настроены</p>
          <Button size="sm" onClick={handleSeedDefaults}>
            <Globe size={14} className="mr-2" />
            Добавить RU + EN
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {languages.map((lang) => (
            <div
              key={lang.id}
              className={`flex items-center gap-2 p-2 rounded border ${
                lang.isActive 
                  ? 'border-gray-200 bg-white' 
                  : 'border-gray-100 bg-gray-50 opacity-60'
              }`}
            >
              <GripVertical size={14} className="text-gray-300 cursor-grab" />
              
              <span className="text-lg" title={lang.name}>{lang.flag || '🌐'}</span>
              
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {lang.nativeName}
                  <span className="text-gray-400 text-xs ml-1">({lang.code})</span>
                </div>
                {lang.direction === 'rtl' && (
                  <span className="text-[10px] text-purple-600 bg-purple-50 px-1 rounded">RTL</span>
                )}
              </div>

              {lang.isDefault ? (
                <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Star size={10} fill="currentColor" />
                  Основной
                </span>
              ) : (
                <button
                  onClick={() => handleSetDefault(lang)}
                  className="text-gray-400 hover:text-amber-500 p-1"
                  title="Сделать основным"
                >
                  <Star size={14} />
                </button>
              )}

              <button
                onClick={() => handleToggleActive(lang)}
                className={`p-1 rounded ${
                  lang.isActive 
                    ? 'text-green-600 hover:text-green-700' 
                    : 'text-gray-400 hover:text-green-500'
                }`}
                title={lang.isActive ? 'Деактивировать' : 'Активировать'}
              >
                <Check size={14} />
              </button>

              {!lang.isDefault && (
                deleteConfirm === lang.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(lang.id)}
                      className="text-red-600 hover:text-red-700 p-1"
                      title="Подтвердить"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(lang.id)}
                    className="text-gray-400 hover:text-red-500 p-1"
                    title="Удалить"
                  >
                    <Trash2 size={14} />
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Language Form */}
      {showAddForm ? (
        <div className="border border-blue-200 bg-blue-50 rounded p-3 space-y-3">
          <div className="text-xs font-medium text-blue-800">Добавить язык</div>
          
          {/* Quick select common languages */}
          {availableCommon.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {availableCommon.slice(0, 8).map((cl) => (
                <button
                  key={cl.code}
                  onClick={() => handleSelectCommon(cl)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    newLang.code === cl.code
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {cl.flag} {cl.nativeName}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Код"
              value={newLang.code}
              onChange={(e) => setNewLang({ ...newLang, code: e.target.value })}
              placeholder="en"
            />
            <Input
              label="Название"
              value={newLang.name}
              onChange={(e) => setNewLang({ ...newLang, name: e.target.value })}
              placeholder="English"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Родное название"
              value={newLang.nativeName}
              onChange={(e) => setNewLang({ ...newLang, nativeName: e.target.value })}
              placeholder="English"
            />
            <Input
              label="Флаг"
              value={newLang.flag || ''}
              onChange={(e) => setNewLang({ ...newLang, flag: e.target.value })}
              placeholder="🇬🇧"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Направление:</label>
            <select
              value={newLang.direction}
              onChange={(e) => setNewLang({ ...newLang, direction: e.target.value as 'ltr' | 'rtl' })}
              className="text-xs border rounded px-2 py-1"
            >
              <option value="ltr">LTR (слева направо)</option>
              <option value="rtl">RTL (справа налево)</option>
            </select>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddLanguage} disabled={!newLang.code || !newLang.name || !newLang.nativeName}>
              <Check size={14} className="mr-1" />
              Добавить
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowAddForm(false)}>
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" className="w-full" onClick={() => setShowAddForm(true)}>
          <Plus size={14} className="mr-1" />
          Добавить язык
        </Button>
      )}

      <div className="mt-3 text-[11px] text-gray-400 flex items-start gap-1">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        <span>Основной язык — это язык, на котором создаётся контент в редакторе. Переводы делаются из основного языка.</span>
      </div>
    </div>
  )
}
