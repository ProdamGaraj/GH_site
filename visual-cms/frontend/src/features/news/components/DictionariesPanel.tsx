import React, { useEffect, useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { inputCls } from '@/shared/forms/fields'
import { cn } from '@/shared/utils'
import { newsApi } from '../api'
import type { DictionaryEntry, DictionaryKind } from '../types'

const KEY_RE = /^[a-z0-9_-]{1,40}$/

const emptyEntry = (order: number): DictionaryEntry => ({ key: '', nameRu: '', nameUz: '', nameEn: '', order, hidden: false })

const cellCls = cn(inputCls, 'px-2 py-1')

/** Строка словаря: правится на месте, сохраняется своей кнопкой. */
const EntryRow: React.FC<{
  entry: DictionaryEntry
  isNew?: boolean
  onSave: (entry: DictionaryEntry) => Promise<void>
  onRemove?: () => Promise<void>
}> = ({ entry, isNew, onSave, onRemove }) => {
  // Черновик строки; новая строка сбрасывается сменой key после добавления.
  const [draft, setDraft] = useState(entry)
  const dirty = JSON.stringify(draft) !== JSON.stringify(entry)
  const keyInvalid = isNew && draft.key !== '' && !KEY_RE.test(draft.key)
  const canSave = dirty && draft.nameRu.trim() !== '' && (!isNew || KEY_RE.test(draft.key))
  const set = (patch: Partial<DictionaryEntry>) => setDraft({ ...draft, ...patch })

  return (
    <tr className="align-middle" data-testid={isNew ? 'dict-new-row' : 'dict-row'}>
      <td className="py-1.5 pr-2">
        {isNew ? (
          <input
            className={cn(cellCls, keyInvalid && 'border-red-400')}
            aria-label="Ключ"
            placeholder="promo"
            value={draft.key}
            onChange={(e) => set({ key: e.target.value.toLowerCase() })}
          />
        ) : (
          <code className="text-sm text-gray-600">{entry.key}</code>
        )}
      </td>
      <td className="py-1.5 pr-2"><input className={cellCls} aria-label="Название RU" value={draft.nameRu} onChange={(e) => set({ nameRu: e.target.value })} /></td>
      <td className="py-1.5 pr-2"><input className={cellCls} aria-label="Название UZ" placeholder={draft.nameRu} value={draft.nameUz} onChange={(e) => set({ nameUz: e.target.value })} /></td>
      <td className="py-1.5 pr-2"><input className={cellCls} aria-label="Название EN" placeholder={draft.nameRu} value={draft.nameEn} onChange={(e) => set({ nameEn: e.target.value })} /></td>
      <td className="py-1.5 pr-2 w-20"><input type="number" className={cellCls} aria-label="Порядок" value={draft.order} onChange={(e) => set({ order: Number(e.target.value) || 0 })} /></td>
      <td className="py-1.5 pr-2 text-center">
        <input type="checkbox" className="h-4 w-4" aria-label="Скрыть" checked={draft.hidden} onChange={(e) => set({ hidden: e.target.checked })} />
      </td>
      <td className="py-1.5 whitespace-nowrap text-right">
        <button type="button" aria-label={isNew ? 'Добавить' : 'Сохранить'} disabled={!canSave} onClick={() => onSave(draft)} className="p-1.5 text-primary-700 disabled:opacity-30">
          {isNew ? <Plus size={16} /> : <Save size={16} />}
        </button>
        {onRemove && (
          <button type="button" aria-label="Удалить" onClick={onRemove} className="p-1.5 text-red-500 hover:text-red-700">
            <Trash2 size={16} />
          </button>
        )}
      </td>
    </tr>
  )
}

/** Таблица рубрик или тегов. */
export const DictionaryTable: React.FC<{ kind: DictionaryKind; title: string; hint: string }> = ({ kind, title, hint }) => {
  const [items, setItems] = useState<DictionaryEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [newKey, setNewKey] = useState(0)

  const load = () =>
    newsApi
      .listDictionary(kind)
      .then(setItems)
      .catch((e) => setError(e?.message || 'Не удалось загрузить'))

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  const act = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      await load()
    } catch (e: any) {
      setError(e?.message || 'Ошибка')
    }
  }

  return (
    <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{hint}</p>
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-gray-400">
            <th className="pb-2 font-medium">Ключ</th>
            <th className="pb-2 font-medium">RU</th>
            <th className="pb-2 font-medium">UZ</th>
            <th className="pb-2 font-medium">EN</th>
            <th className="pb-2 font-medium">Порядок</th>
            <th className="pb-2 font-medium text-center">Скрыт</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => (
            <EntryRow
              key={entry.key}
              entry={entry}
              onSave={(d) => act(() => newsApi.updateDictionary(kind, entry.key, { nameRu: d.nameRu, nameUz: d.nameUz, nameEn: d.nameEn, order: d.order, hidden: d.hidden }))}
              onRemove={() => {
                if (!confirm(`Удалить «${entry.nameRu}»?`)) return Promise.resolve()
                return act(() => newsApi.removeDictionary(kind, entry.key))
              }}
            />
          ))}
          <EntryRow
            key={`new-${newKey}`}
            isNew
            entry={emptyEntry(items.length)}
            onSave={(d) =>
              act(async () => {
                await newsApi.createDictionary(kind, { ...d, key: d.key.trim() })
                setNewKey((k) => k + 1)
              })
            }
          />
        </tbody>
      </table>
    </section>
  )
}

export const DictionariesPanel: React.FC = () => (
  <div className="max-w-5xl mx-auto p-6 space-y-6">
    <DictionaryTable
      kind="categories"
      title="Рубрики"
      hint="Бейдж карточки и фильтр «тип» в ленте: «Новости», «Акции». Ключ не меняется. Рубрику, которая есть у новостей, не удалить — её можно скрыть."
    />
    <DictionaryTable
      kind="tags"
      title="Теги"
      hint="Фильтр по тегам в ленте. Пустой перевод — на сайте название по-русски."
    />
  </div>
)
