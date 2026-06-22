import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { Header } from '@/shared/components/Header'
import { ArrowLeft, Save, Globe, Palette, Code, Building2, BarChart3, Rocket, Menu } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  fetchSiteById,
  updateSite,
  updateSiteSettings,
  selectCurrentSite,
  selectSitesSaving,
} from '@/features/sites/sitesSlice'
import { fetchPages, selectPages } from '@/features/pages/pagesSlice'
import type { Site, SiteSettings } from '@/shared/types'
import { DeployHistory } from '@/features/deploy/DeployHistory'
import { NavigationEditor } from '@/features/sites/components/NavigationEditor'

type Tab = 'general' | 'navigation' | 'seo' | 'branding' | 'analytics' | 'company' | 'code' | 'deploy'

export const SiteSettingsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const dispatch = useAppDispatch()
  const site = useAppSelector(selectCurrentSite)
  const saving = useAppSelector(selectSitesSaving)
  const pages = useAppSelector(selectPages)

  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [routingMode, setRoutingMode] = useState<Site['routingMode']>('subdomain')
  const [hostname, setHostname] = useState('')
  const [homepageId, setHomepageId] = useState('')
  const [settings, setSettings] = useState<SiteSettings>({})

  useEffect(() => {
    if (id) {
      dispatch(fetchSiteById(id))
      dispatch(fetchPages(id))
    }
  }, [id, dispatch])

  useEffect(() => {
    if (site) {
      setName(site.name)
      setSlug(site.slug)
      setDescription(site.description || '')
      setRoutingMode(site.routingMode)
      setHostname(site.hostname || '')
      setHomepageId(site.homepageId || '')
      setSettings(site.settings || {})
    }
  }, [site])

  const handleSaveGeneral = async () => {
    if (!id) return
    await dispatch(updateSite({
      id,
      data: { name, slug, description, routingMode, hostname, homepageId: homepageId || null },
    })).unwrap()
  }

  const [settingsSaved, setSettingsSaved] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  const handleSaveSettings = async () => {
    if (!id) return
    setSettingsSaved(false)
    setSettingsError(null)
    try {
      await dispatch(updateSiteSettings({ id, settings })).unwrap()
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 3000)
    } catch (err: any) {
      setSettingsError(err?.message || 'Ошибка сохранения настроек')
    }
  }

  const updateField = (field: keyof SiteSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'Основные', icon: <Globe size={16} /> },
    { id: 'navigation', label: 'Навигация', icon: <Menu size={16} /> },
    { id: 'seo', label: 'SEO', icon: <Globe size={16} /> },
    { id: 'branding', label: 'Брендинг', icon: <Palette size={16} /> },
    { id: 'analytics', label: 'Аналитика', icon: <BarChart3 size={16} /> },
    { id: 'company', label: 'Компания', icon: <Building2 size={16} /> },
    { id: 'code', label: 'Код', icon: <Code size={16} /> },
    { id: 'deploy', label: 'Деплой', icon: <Rocket size={16} /> },
  ]

  if (!site) {
    return (
      <div className="h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Загрузка...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mb-6">
          <Link to="/sites" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft size={16} />
            Назад к сайтам
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Настройки: {site.name}</h1>
          <p className="text-gray-600 mt-1">Конфигурация сайта, SEO, аналитика и брендинг</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название сайта</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  placeholder="(пусто = корневой домен)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Оставьте пустым, чтобы сайт был доступен на корневом домене
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Режим маршрутизации</label>
                <select
                  value={routingMode}
                  onChange={(e) => setRoutingMode(e.target.value as Site['routingMode'])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="subdomain">Поддомен (premium.site.com)</option>
                  <option value="path-prefix">Путь (site.com/premium/)</option>
                  <option value="custom-domain">Свой домен</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Поддомен — лучшая стратегия для независимого SEO-индексирования
                </p>
              </div>
              {(routingMode === 'subdomain' || routingMode === 'custom-domain') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {routingMode === 'subdomain' ? 'Базовый домен' : 'Домен'}
                  </label>
                  <input
                    type="text"
                    value={hostname}
                    onChange={(e) => setHostname(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={routingMode === 'subdomain' ? 'goldenhouse.com' : 'premium-landing.com'}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Домашняя страница</label>
                <select
                  value={homepageId}
                  onChange={(e) => setHomepageId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">— Не выбрана —</option>
                  {pages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.name} ({page.slug})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Страница, которая будет открываться по умолчанию (index.html)
                </p>
              </div>
              <div className="pt-4">
                <Button onClick={handleSaveGeneral} disabled={saving}>
                  <Save size={16} className="mr-2" />
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </div>
            </div>
          )}

          {/* SEO Tab */}
          {activeTab === 'navigation' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Меню навигации</h3>
              <NavigationEditor
                items={settings.navigation || []}
                onChange={(nav) => setSettings(prev => ({ ...prev, navigation: nav }))}
                pages={pages}
              />
              <div className="pt-4 flex items-center gap-3">
                <Button onClick={handleSaveSettings} disabled={saving}>
                  <Save size={16} className="mr-2" />
                  {saving ? 'Сохранение...' : 'Сохранить навигацию'}
                </Button>
                {settingsSaved && (
                  <span className="text-sm text-green-600">Навигация сохранена ✓</span>
                )}
                {settingsError && (
                  <span className="text-sm text-red-600">{settingsError}</span>
                )}
              </div>
            </div>
          )}

          {/* SEO Tab */}
          {activeTab === 'seo' && (
            <div className="space-y-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Заголовок по умолчанию (title)</label>
                <input
                  type="text"
                  value={settings.defaultTitle || ''}
                  onChange={(e) => updateField('defaultTitle', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Golden House — Элитная недвижимость"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Описание по умолчанию (meta description)</label>
                <textarea
                  value={settings.defaultDescription || ''}
                  onChange={(e) => updateField('defaultDescription', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ключевые слова</label>
                <input
                  type="text"
                  value={(settings.defaultKeywords || []).join(', ')}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    defaultKeywords: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean),
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="недвижимость, элитная, квартиры"
                />
                <p className="text-xs text-gray-500 mt-1">Через запятую</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Имя сайта (для OG)</label>
                <input
                  type="text"
                  value={settings.siteName || ''}
                  onChange={(e) => updateField('siteName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">OG Image URL</label>
                <input
                  type="text"
                  value={settings.ogImage || ''}
                  onChange={(e) => updateField('ogImage', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Favicon URL</label>
                <input
                  type="text"
                  value={settings.favicon || ''}
                  onChange={(e) => updateField('favicon', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="/favicon.ico"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Язык по умолчанию</label>
                <select
                  value={settings.defaultLanguage || 'ru'}
                  onChange={(e) => updateField('defaultLanguage', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                  <option value="kz">Қазақша</option>
                </select>
              </div>
              <div className="pt-4">
                <Button onClick={handleSaveSettings} disabled={saving}>
                  <Save size={16} className="mr-2" />
                  {saving ? 'Сохранение...' : 'Сохранить SEO'}
                </Button>
              </div>
            </div>
          )}

          {/* Branding Tab */}
          {activeTab === 'branding' && (
            <div className="space-y-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Логотип URL</label>
                <input
                  type="text"
                  value={settings.logo || ''}
                  onChange={(e) => updateField('logo', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Основной шрифт</label>
                  <input
                    type="text"
                    value={settings.primaryFont || ''}
                    onChange={(e) => updateField('primaryFont', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Inter"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Дополнительный шрифт</label>
                  <input
                    type="text"
                    value={settings.secondaryFont || ''}
                    onChange={(e) => updateField('secondaryFont', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Playfair Display"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Основной цвет</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.primaryColor || '#1a365d'}
                      onChange={(e) => updateField('primaryColor', e.target.value)}
                      className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.primaryColor || ''}
                      onChange={(e) => updateField('primaryColor', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                      placeholder="#1a365d"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Вторичный цвет</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.secondaryColor || '#c9a96e'}
                      onChange={(e) => updateField('secondaryColor', e.target.value)}
                      className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.secondaryColor || ''}
                      onChange={(e) => updateField('secondaryColor', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                      placeholder="#c9a96e"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Акцентный цвет</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.accentColor || '#e53e3e'}
                      onChange={(e) => updateField('accentColor', e.target.value)}
                      className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.accentColor || ''}
                      onChange={(e) => updateField('accentColor', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                      placeholder="#e53e3e"
                    />
                  </div>
                </div>
              </div>
              <div className="pt-4">
                <Button onClick={handleSaveSettings} disabled={saving}>
                  <Save size={16} className="mr-2" />
                  {saving ? 'Сохранение...' : 'Сохранить брендинг'}
                </Button>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Google Analytics ID</label>
                <input
                  type="text"
                  value={settings.googleAnalyticsId || ''}
                  onChange={(e) => updateField('googleAnalyticsId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  placeholder="G-XXXXXXXXXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Google Tag Manager ID</label>
                <input
                  type="text"
                  value={settings.googleTagManagerId || ''}
                  onChange={(e) => updateField('googleTagManagerId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  placeholder="GTM-XXXXXXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meta Pixel ID</label>
                <input
                  type="text"
                  value={settings.metaPixelId || ''}
                  onChange={(e) => updateField('metaPixelId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  placeholder="123456789"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Яндекс.Метрика ID</label>
                <input
                  type="text"
                  value={settings.yandexMetrikaId || ''}
                  onChange={(e) => updateField('yandexMetrikaId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  placeholder="12345678"
                />
              </div>
              <div className="pt-4">
                <Button onClick={handleSaveSettings} disabled={saving}>
                  <Save size={16} className="mr-2" />
                  {saving ? 'Сохранение...' : 'Сохранить аналитику'}
                </Button>
              </div>
            </div>
          )}

          {/* Company Tab */}
          {activeTab === 'company' && (
            <div className="space-y-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название компании</label>
                <input
                  type="text"
                  value={settings.companyName || ''}
                  onChange={(e) => updateField('companyName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Golden House"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
                <input
                  type="text"
                  value={settings.phone || ''}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+7 (777) 123-45-67"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={settings.email || ''}
                  onChange={(e) => updateField('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="info@goldenhouse.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Адрес</label>
                <textarea
                  value={settings.address || ''}
                  onChange={(e) => updateField('address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                />
              </div>
              <div className="pt-4">
                <Button onClick={handleSaveSettings} disabled={saving}>
                  <Save size={16} className="mr-2" />
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </div>
            </div>
          )}

          {/* Code Injection Tab */}
          {activeTab === 'code' && (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                Будьте осторожны: пользовательский код внедряется напрямую в HTML страниц сайта
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Общий CSS сайта
                </label>
                <p className="text-xs text-gray-500 mb-1">
                  Применяется ко всем страницам сайта. Оборачивается в &lt;style&gt; на деплое (пишите чистый CSS).
                </p>
                <textarea
                  value={settings.globalCss || ''}
                  onChange={(e) => updateField('globalCss', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  rows={8}
                  placeholder=".btn { border-radius: 8px; }"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Общий JS сайта
                </label>
                <p className="text-xs text-gray-500 mb-1">
                  Выполняется на всех страницах сайта. Оборачивается в &lt;script&gt; на деплое (пишите чистый JS).
                </p>
                <textarea
                  value={settings.globalJs || ''}
                  onChange={(e) => updateField('globalJs', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  rows={8}
                  placeholder="console.log('site loaded')"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Код в &lt;head&gt; (перед закрывающим &lt;/head&gt;)
                </label>
                <textarea
                  value={settings.customHeadHtml || ''}
                  onChange={(e) => updateField('customHeadHtml', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  rows={8}
                  placeholder="<!-- Google Analytics, Meta Pixel и другие скрипты -->"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Код перед &lt;/body&gt;
                </label>
                <textarea
                  value={settings.customBodyEndHtml || ''}
                  onChange={(e) => updateField('customBodyEndHtml', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  rows={8}
                  placeholder="<!-- Виджеты чата, CRM-скрипты и т.д. -->"
                />
              </div>
              <div className="pt-4">
                <Button onClick={handleSaveSettings} disabled={saving}>
                  <Save size={16} className="mr-2" />
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </div>
            </div>
          )}
          {activeTab === 'deploy' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">История деплоев</h3>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <DeployHistory siteId={id} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
