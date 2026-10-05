import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Newspaper, Plus, Tags } from 'lucide-react'
import { inputCls } from '@/shared/forms/fields'
import { cn } from '@/shared/utils'
import { newsApi } from '../api'
import type { ExtraLocale, LocaleState, NewsListItem, NewsStatus } from '../types'
import { EXTRA_LOCALES } from '../types'
import { missingText } from '../newsForm'
import { StatusBadge } from './StatusBadge'

type StatusFilter = 'all' | NewsStatus
const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'draft', label: 'Черновики' },
  { value: 'published', label: 'Опубликованные' },
  { value: 'archived', label: 'Архив' },
]

/** Язык новости: отмечен и переведён / отмечен, но перевод неполный / не отмечен. */
const LocaleChip: React.FC<{ locale: ExtraLocale; state: LocaleState }> = ({ locale, state }) => {
  const ready = state.enabled && state.missing.length === 0
  const broken = state.enabled && state.missing.length > 0
  const title = ready
    ? `Публикуется на ${locale.toUpperCase()}`
    : broken
      ? `Отмечен, но перевод неполный — на сайте не будет. Не хватает: ${missingText(state.missing)}`
      : `Не публикуется на ${locale.toUpperCase()}`
  return (
    <span
      title={title}
      data-testid={`locale-${locale}`}
      data-state={ready ? 'ready' : broken ? 'broken' : 'off'}
      className={cn(
        'rounded px-1.5 py-0.5 text-xs font-medium',
        ready && 'bg-green-100 text-green-800',
        broken && 'bg-amber-100 text-amber-800',
        !state.enabled && 'bg-gray-100 text-gray-400'
      )}
    >
      {locale.toUpperCase()}
      {broken && ' !'}
    </span>
  )
}

function dateText(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

/** Список новостей: фильтр по статусу, поиск по заголовку, создание. */
export const NewsList: React.FC = () => {
  const [items, setItems] = useState<NewsListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    newsApi
      .list()
      .then(setItems)
      .catch((e) => setError(e?.message || 'Не удалось загрузить новости'))
      .finally(() => setLoading(false))
  }, [])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((n) => (filter === 'all' || n.status === filter) && (!q || n.title.toLowerCase().includes(q)))
  }, [items, filter, query])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    setError(null)
    try {
      const news = await newsApi.create({ title: title.trim() })
      navigate(`/news/${news.id}`)
    } catch (err: any) {
      setError(err?.message || 'Не удалось создать новость')
      setCreating(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Newspaper size={24} /> Новости
        </h1>
        <Link
          to="/news/dictionaries"
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50"
        >
          <Tags size={16} /> Рубрики и теги
        </Link>
      </div>

      <form onSubmit={create} className="flex gap-2">
        <input
          className={inputCls}
          placeholder="Заголовок новой новости"
          aria-label="Заголовок новой новости"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          type="submit"
          disabled={creating || !title.trim()}
          className="flex shrink-0 items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50"
        >
          <Plus size={16} /> Создать
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-gray-300 bg-white text-sm" role="group" aria-label="Статус">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn('px-3 py-1.5', filter === f.value ? 'bg-primary-50 text-primary-700' : 'text-gray-600')}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input className={cn(inputCls, 'max-w-xs')} placeholder="Поиск по заголовку" aria-label="Поиск по заголовку" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {loading ? (
        <p className="text-gray-500">Загрузка…</p>
      ) : shown.length === 0 ? (
        <p className="text-gray-400">{items.length === 0 ? 'Новостей пока нет — создайте первую.' : 'Ничего не найдено.'}</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {shown.map((n) => (
            <li key={n.id}>
              <Link to={`/news/${n.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-gray-50" data-testid="news-row">
                <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{n.title || 'Без заголовка'}</span>
                <span className="text-sm text-gray-500 whitespace-nowrap">{dateText(n.publishedAt)}</span>
                <span className="flex gap-1">
                  {EXTRA_LOCALES.map((l) => (
                    <LocaleChip key={l} locale={l} state={n.locales[l]} />
                  ))}
                </span>
                <StatusBadge status={n.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
