import React, { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import type { ComplexDetail, Locale } from '../types'
import { estateApi } from '../api'
import { LocaleTabs } from './fields'
import { ComplexForm } from './ComplexForm'
import { HouseCard } from './HouseCard'

/** Редактор одного ЖК: комплекс + дома + квартиры, вкладки языков. */
export const EstateEditor: React.FC = () => {
  const { id = '' } = useParams()
  const [complex, setComplex] = useState<ComplexDetail | null>(null)
  const [locale, setLocale] = useState<Locale>('ru')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setComplex(await estateApi.getComplex(id))
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить ЖК')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const reload = async () => {
    await load()
    setVersion((v) => v + 1)
  }

  const addHouse = async () => {
    await estateApi.createHouse(id, { name: 'Новый корпус', order: complex?.houses.length || 0 })
    reload()
  }

  if (loading) return <div className="p-8 text-gray-500">Загрузка…</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>
  if (!complex) return null

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/estate" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{complex.name}</h1>
          <span className="text-sm text-gray-400">/{complex.slug}</span>
        </div>
        <LocaleTabs active={locale} onChange={setLocale} />
      </div>

      <ComplexForm key={`complex-${version}`} complex={complex} locale={locale} />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Дома / корпуса</h2>
          <button
            onClick={addHouse}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
          >
            <Plus size={16} /> Добавить дом
          </button>
        </div>
        {complex.houses.map((house) => (
          <HouseCard key={`${house.id}-${version}`} house={house} locale={locale} onChanged={reload} />
        ))}
        {complex.houses.length === 0 && <p className="text-sm text-gray-400">Пока нет домов.</p>}
      </div>
    </div>
  )
}
