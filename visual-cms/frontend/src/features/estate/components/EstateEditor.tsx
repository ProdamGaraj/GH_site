import React, { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { ComplexDetail, Locale } from '../types'
import { estateApi } from '../api'
import { SECTION, sectionsFor } from '../sections'
import { LocaleTabs } from './fields'
import { ComplexForm } from './ComplexForm'
import { AddHouseForm, HouseCard } from './HouseCard'
import { isRu } from './tfield'
import { PlanGroupingPanel } from './PlanGroupingPanel'
import { ProjectSyncButton } from './ProjectSyncButton'
import { SectionNav } from './SectionNav'

/**
 * Редактор одного ЖК: комплекс + дома + квартиры, вкладки языков.
 *
 * Сверху закреплённая полоса: название, языки и «Сохранить ЖК» (кнопку
 * кладёт туда сама форма — `actionsSlot`). Слева меню разделов.
 */
export const EstateEditor: React.FC = () => {
  const { id = '' } = useParams()
  const [complex, setComplex] = useState<ComplexDetail | null>(null)
  const [locale, setLocale] = useState<Locale>('ru')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  // Место в закреплённой полосе, куда форма ЖК кладёт свою кнопку сохранения.
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null)
  // Растёт после синхронизации с CRM: раздел планировок пересчитывает превью
  // по свежим данным, не теряя черновик.
  const [syncToken, setSyncToken] = useState(0)

  // Экран «Загрузка…» — только пока ЖК ещё не открыт. Повторная загрузка
  // (после правки домов, после синхронизации) обновляет данные на месте:
  // иначе страница размонтировалась бы вместе с несохранёнными правками.
  const load = useCallback(async () => {
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
    setLoading(true)
    load()
  }, [load])

  // После синхронизации дома получили данные CRM (название, этажность, срок):
  // карточки домов перечитывают их заново, превью планировок пересчитывается.
  const onSynced = useCallback(async () => {
    await load()
    setVersion((v) => v + 1)
    setSyncToken((t) => t + 1)
  }, [load])

  const houseIds = (complex?.houses ?? [])
    .map((h) => h.externalId)
    .filter((externalId): externalId is number => typeof externalId === 'number')

  if (loading && !complex) return <div className="p-8 text-gray-500">Загрузка…</div>
  if (!complex) return <div className="p-8 text-red-600">{error ?? 'ЖК не найден'}</div>

  return (
    <div className="min-h-full bg-gray-50">
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-gray-50/95 backdrop-blur">
        <div className="max-w-[1560px] mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/estate" className="text-gray-400 hover:text-gray-600" aria-label="К списку ЖК">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 truncate">{complex.name}</h1>
            <span className="text-sm text-gray-400 truncate">/{complex.slug}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {error && <span className="text-sm text-red-600">{error}</span>}
            <LocaleTabs active={locale} onChange={setLocale} className="mb-0 border-b-0" />
            <ProjectSyncButton externalHouseIds={houseIds} onFinished={onSynced} />
            <div ref={setActionsSlot} data-testid="estate-actions" />
          </div>
        </div>
      </div>

      <div className="max-w-[1560px] mx-auto px-6 py-6 grid lg:grid-cols-[200px_minmax(0,1fr)] gap-8">
        <SectionNav sections={sectionsFor(locale)} />

        <div className="space-y-6 min-w-0">
          {/* Стабильный ключ по id: операции с домами (reload + version++) НЕ
              перемонтируют форму комплекса, иначе несохранённые правки проекта
              затираются серверными данными. Комплекс правится только своей кнопкой
              «Сохранить ЖК». */}
          <ComplexForm
            key={`complex-${complex.id}`}
            complex={complex}
            locale={locale}
            actionsSlot={actionsSlot}
            onSaved={load}
          />

          {/* Склейка не зависит от языка и сохраняется своей кнопкой; ключ по id
              по той же причине, что у формы: reload после правки домов не должен
              сбрасывать черновик. */}
          <div id={SECTION.plans} className="scroll-mt-24">
            <PlanGroupingPanel
              key={`plans-${complex.id}`}
              complexId={complex.id}
              initial={complex.planGrouping}
              refreshToken={syncToken}
            />
          </div>

          <div id={SECTION.houses} className="space-y-4 scroll-mt-24">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Дома / корпуса</h2>
              <p className="text-sm text-gray-500">
                Дом — единица MacroCRM: даёт странице проекта квартиры, планировки и срок сдачи. Страница и
                карточка на главной — у проекта.
              </p>
            </div>
            {complex.houses.map((house) => (
              <HouseCard key={`${house.id}-${version}`} house={house} locale={locale} onChanged={load} />
            ))}
            {complex.houses.length === 0 && <p className="text-sm text-gray-400">Пока нет домов.</p>}
            {isRu(locale) && (
              <AddHouseForm complexId={complex.id} nextOrder={complex.houses.length} onAdded={load} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
