import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Building2, Layers } from 'lucide-react'
import type { ComplexListItem } from '../types'
import { estateApi } from '../api'
import { ApiError } from '@/shared/api/http'
import { ProvisionCollectionModal } from './ProvisionCollectionModal'

/** Список ЖК + создание нового. */
export const EstateList: React.FC = () => {
  const [items, setItems] = useState<ComplexListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [showProvision, setShowProvision] = useState(false)
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      setItems(await estateApi.listComplexes())
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить список')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const create = async () => {
    setFormError(null)
    try {
      const { id } = await estateApi.createComplex({ slug, name })
      navigate(`/estate/${id}`)
    } catch (e) {
      const err = e as ApiError
      setFormError(err.status === 409 ? 'ЖК с таким slug уже существует' : err.message)
    }
  }

  const remove = async (item: ComplexListItem) => {
    if (!confirm(`Удалить ЖК «${item.name}» со всеми домами и квартирами?`)) return
    await estateApi.deleteComplex(item.id)
    load()
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Building2 size={24} /> Жилые комплексы
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProvision(true)}
            className="flex items-center gap-2 px-4 py-2 border border-primary-600 text-primary-700 rounded-md text-sm hover:bg-primary-50"
          >
            <Layers size={16} /> Страницы проектов
          </button>
          <button
            onClick={() => setCreating((c) => !c)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700"
          >
            <Plus size={16} /> Новый ЖК
          </button>
        </div>
      </div>

      {showProvision && <ProvisionCollectionModal onClose={() => setShowProvision(false)} />}

      {creating && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Assalom Doʼstlik"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="assalom-dostlik"
              />
            </div>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Отмена
            </button>
            <button
              onClick={create}
              disabled={!slug || !name}
              className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50"
            >
              Создать
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-gray-500">Загрузка…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
              <Link to={`/estate/${item.id}`} className="flex-1">
                <span className="font-medium text-gray-900">{item.name}</span>
                <span className="ml-3 text-sm text-gray-400">/{item.slug}</span>
                <span className="ml-3 text-xs text-gray-500">{item.className}</span>
                {item.status === 'sold_out' && (
                  <span className="ml-2 text-xs px-2 py-0.5 bg-gray-200 rounded">Sold out</span>
                )}
              </Link>
              <button onClick={() => remove(item)} className="text-red-500 hover:text-red-700">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {items.length === 0 && <p className="px-4 py-6 text-gray-400">Пока нет ЖК. Создайте первый.</p>}
        </div>
      )}
    </div>
  )
}
