import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { Header } from '@/shared/components/Header'
import { Plus, Trash2, Globe, Copy, Rocket, Settings, FileText, ExternalLink } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  fetchSites,
  createSite,
  deleteSite,
  duplicateSite,
  deploySite,
  selectSites,
  selectSitesLoading,
  selectSitesSaving,
} from '@/features/sites/sitesSlice'
import type { Site } from '@/shared/types'
import { getSitePublicUrl } from '@/shared/utils'

export const SitesList: React.FC = () => {
  const dispatch = useAppDispatch()
  const sites = useAppSelector(selectSites)
  const loading = useAppSelector(selectSitesLoading)
  const saving = useAppSelector(selectSitesSaving)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newSiteName, setNewSiteName] = useState('')
  const [newSiteSlug, setNewSiteSlug] = useState('')
  const [newSiteRouting, setNewSiteRouting] = useState<'subdomain' | 'path-prefix' | 'custom-domain'>('subdomain')
  const [deployingId, setDeployingId] = useState<string | null>(null)

  useEffect(() => {
    dispatch(fetchSites())
  }, [dispatch])

  const handleCreate = async () => {
    if (!newSiteName.trim() || !newSiteSlug.trim()) return
    try {
      await dispatch(createSite({
        name: newSiteName.trim(),
        slug: newSiteSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        routingMode: newSiteRouting,
      })).unwrap()
      setShowCreateModal(false)
      setNewSiteName('')
      setNewSiteSlug('')
      setNewSiteRouting('subdomain')
    } catch (error) {
      console.error('Failed to create site:', error)
    }
  }

  const handleDelete = async (site: Site) => {
    if (site.isDefault) {
      alert('Нельзя удалить сайт по умолчанию')
      return
    }
    if (window.confirm(`Удалить сайт "${site.name}"? Страницы будут откреплены, но не удалены.`)) {
      try {
        await dispatch(deleteSite(site.id)).unwrap()
      } catch (error) {
        console.error('Failed to delete site:', error)
      }
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      await dispatch(duplicateSite(id)).unwrap()
    } catch (error) {
      console.error('Failed to duplicate site:', error)
    }
  }

  const handleDeploy = async (id: string) => {
    setDeployingId(id)
    try {
      await dispatch(deploySite(id)).unwrap()
    } catch (error) {
      console.error('Failed to deploy site:', error)
    } finally {
      setDeployingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      active: 'bg-green-100 text-green-700',
      archived: 'bg-red-100 text-red-700',
    }
    const labels: Record<string, string> = {
      draft: 'Черновик',
      active: 'Активен',
      archived: 'Архив',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    )
  }

  const getRoutingLabel = (mode: string) => {
    const labels: Record<string, string> = {
      subdomain: 'Поддомен',
      'path-prefix': 'Путь',
      'custom-domain': 'Свой домен',
    }
    return labels[mode] || mode
  }

  const getSiteUrl = (site: Site) => getSitePublicUrl(site)

  const slugFromName = (name: string) =>
    name.toLowerCase().replace(/[а-яё]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Сайты</h1>
            <p className="text-gray-600 mt-1">Управление сайтами и лендингами компании</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus size={16} className="mr-2" />
            Создать сайт
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Загрузка...</div>
          </div>
        ) : sites.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-12 text-center">
              <Globe size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">Сайты ещё не созданы</p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus size={16} className="mr-2" />
                Создать первый сайт
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {sites.map((site) => (
              <div
                key={site.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{site.name}</h3>
                      {getStatusBadge(site.status || 'draft')}
                      {site.isDefault && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          По умолчанию
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="font-mono">/{site.slug}</span>
                      <span>{getRoutingLabel(site.routingMode)}</span>
                      {site.hostname && <span className="text-blue-600">{site.hostname}</span>}
                      {site.pageCount !== undefined && (
                        <span className="flex items-center gap-1">
                          <FileText size={14} />
                          {site.pageCount} стр.
                        </span>
                      )}
                    </div>
                    {site.description && (
                      <p className="text-sm text-gray-600 mt-2">{site.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <a
                      href={getSiteUrl(site)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Открыть сайт"
                    >
                      <ExternalLink size={18} />
                    </a>
                    <button
                      onClick={() => handleDeploy(site.id)}
                      disabled={deployingId === site.id}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Опубликовать все страницы"
                    >
                      <Rocket size={18} />
                    </button>
                    <Link
                      to={`/sites/${site.id}/settings`}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Настройки"
                    >
                      <Settings size={18} />
                    </Link>
                    <Link
                      to={`/sites/${site.id}/pages`}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Страницы сайта"
                    >
                      <FileText size={18} />
                    </Link>
                    <button
                      onClick={() => handleDuplicate(site.id)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Дублировать"
                    >
                      <Copy size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(site)}
                      disabled={site.isDefault}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
                      title="Удалить"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md text-gray-900" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-semibold mb-4">Новый сайт</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
                <input
                  type="text"
                  value={newSiteName}
                  onChange={(e) => {
                    setNewSiteName(e.target.value)
                    if (!newSiteSlug || newSiteSlug === slugFromName(newSiteName)) {
                      setNewSiteSlug(slugFromName(e.target.value))
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  placeholder="Golden House Premium"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                <input
                  type="text"
                  value={newSiteSlug}
                  onChange={(e) => setNewSiteSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-gray-900 bg-white"
                  placeholder="premium"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Режим маршрутизации</label>
                <select
                  value={newSiteRouting}
                  onChange={(e) => setNewSiteRouting(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                >
                  <option value="subdomain">Поддомен (premium.site.com) — лучше для SEO</option>
                  <option value="path-prefix">Путь (site.com/premium/)</option>
                  <option value="custom-domain">Свой домен (premium-site.com)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Отмена</Button>
              <Button onClick={handleCreate} disabled={saving || !newSiteName.trim() || !newSiteSlug.trim()}>
                {saving ? 'Создание...' : 'Создать'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
