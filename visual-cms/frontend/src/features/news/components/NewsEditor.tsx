import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, ArrowLeft, ExternalLink, Eye, EyeOff, Lock, Save, Trash2 } from 'lucide-react'
import { ApiError } from '@/shared/api/http'
import { FormSection, Label, LocaleTabs, SelectField, TextArea, TextField, inputCls } from '@/shared/forms/fields'
import { GallerySlidesField } from '@/shared/forms/GallerySlidesField'
import { MediaField } from '@/shared/forms/mediaFields'
import type { Locale } from '@/shared/forms/locales'
import { cn } from '@/shared/utils'
import { newsApi } from '../api'
import type { DictionaryEntry, NewsDetail, NewsDraft } from '../types'
import { describeBlockedLocales, draftOf, fromLocalInput, isDirty, toLocalInput } from '../newsForm'
import { NewsTranslationForm } from './NewsTranslationForm'
import { SectionsEditor } from './SectionsEditor'
import { StatusBadge } from './StatusBadge'

/** Адрес обложки строкой — поле медиа хранит один адрес. */
function coverUrl(cover: NewsDraft['cover']): string {
  if (!cover) return ''
  return typeof cover === 'string' ? cover : cover.url
}

/** Текст ошибки сохранения: недостающий перевод — по-человечески. */
function saveError(e: unknown): string {
  if (e instanceof ApiError) {
    const blocked = describeBlockedLocales(e.details)
    return blocked ? `Язык можно отметить только при полном переводе. ${blocked}` : e.message
  }
  return (e as Error)?.message || 'Не удалось сохранить'
}

/**
 * Редактор новости: карточка ленты, hero и блоки страницы (вкладка RU),
 * перевод и публикация на языке (вкладки UZ/EN).
 *
 * Черновик живёт в форме до «Сохранить». Публикация с несохранёнными
 * правками сначала сохраняет их. На сайт новость попадает после передеплоя
 * коллекции новостей.
 */
export const NewsEditor: React.FC = () => {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [news, setNews] = useState<NewsDetail | null>(null)
  const [draft, setDraft] = useState<NewsDraft | null>(null)
  const [categories, setCategories] = useState<DictionaryEntry[]>([])
  const [tags, setTags] = useState<DictionaryEntry[]>([])
  const [locale, setLocale] = useState<Locale>('ru')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const accept = useCallback((fresh: NewsDetail) => {
    setNews(fresh)
    setDraft(draftOf(fresh))
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([newsApi.get(id), newsApi.listDictionary('categories'), newsApi.listDictionary('tags')])
      .then(([fresh, cats, tagList]) => {
        if (cancelled) return
        accept(fresh)
        setCategories(cats)
        setTags(tagList)
      })
      .catch((e) => !cancelled && setError(e?.message || 'Не удалось загрузить новость'))
    return () => {
      cancelled = true
    }
  }, [id, accept])

  if (!news || !draft) return <div className="p-8 text-gray-500">{error ?? 'Загрузка…'}</div>

  const dirty = isDirty(draft, news)
  const set = (patch: Partial<NewsDraft>) => setDraft({ ...draft, ...patch })

  const run = async (what: () => Promise<NewsDetail | void>, done?: string) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const fresh = await what()
      if (fresh) accept(fresh)
      if (done) setMessage(done)
    } catch (e) {
      setError(saveError(e))
    } finally {
      setBusy(false)
    }
  }

  const save = () => newsApi.update(news.id, draft)
  const saveThen = async (action: () => Promise<NewsDetail>) => {
    if (dirty) await save()
    return action()
  }

  const remove = async () => {
    if (!confirm(`Удалить новость «${news.title}» вместе с переводами?`)) return
    await run(async () => {
      await newsApi.remove(news.id)
      navigate('/news')
    })
  }

  const toggleTag = (key: string) =>
    set({ tagKeys: draft.tagKeys.includes(key) ? draft.tagKeys.filter((k) => k !== key) : [...draft.tagKeys, key] })

  const visibleTags = tags.filter((t) => !t.hidden || draft.tagKeys.includes(t.key))
  const categoryOptions = [
    { value: '', label: '— без рубрики —' },
    ...categories.filter((c) => !c.hidden || c.key === draft.categoryKey).map((c) => ({ value: c.key, label: c.nameRu })),
  ]

  return (
    <div className="min-h-full bg-gray-50">
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-gray-50/95 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/news" className="text-gray-400 hover:text-gray-600" aria-label="К списку новостей">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 truncate">{news.title || 'Без заголовка'}</h1>
            <StatusBadge status={news.status} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {error && <span className="text-sm text-red-600 max-w-md" role="alert">{error}</span>}
            {message && !error && <span className="text-sm text-gray-500">{message}</span>}
            <LocaleTabs active={locale} onChange={setLocale} className="mb-0 border-b-0" />
            {news.status === 'published' && (
              <a
                href={`/ru/news/${news.slug}/`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                title="Откроется после передеплоя коллекции новостей"
              >
                <ExternalLink size={16} /> На сайте
              </a>
            )}
            {news.status === 'published' ? (
              <button type="button" disabled={busy} onClick={() => run(() => saveThen(() => newsApi.unpublish(news.id)), 'Снята с публикации')} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-white disabled:opacity-50">
                <EyeOff size={16} /> Снять
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => run(() => saveThen(() => newsApi.publish(news.id)), 'Опубликована — появится на сайте после передеплоя')} className="flex items-center gap-1.5 px-3 py-2 border border-primary-600 text-primary-700 rounded-md text-sm hover:bg-primary-50 disabled:opacity-50">
                <Eye size={16} /> Опубликовать
              </button>
            )}
            {news.status !== 'archived' && (
              <button type="button" disabled={busy} title="В архив" aria-label="В архив" onClick={() => run(() => saveThen(() => newsApi.archive(news.id)), 'Перенесена в архив')} className="p-2 text-gray-500 hover:text-gray-800 disabled:opacity-50">
                <Archive size={16} />
              </button>
            )}
            <button type="button" disabled={busy} aria-label="Удалить новость" onClick={remove} className="p-2 text-red-500 hover:text-red-700 disabled:opacity-50">
              <Trash2 size={16} />
            </button>
            <button
              type="button"
              disabled={busy || !dirty}
              onClick={() => run(save, 'Сохранено')}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50"
            >
              <Save size={16} /> Сохранить{dirty && <span aria-label="есть несохранённые правки">•</span>}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {locale === 'ru' ? (
          <>
            <FormSection id="news-card" title="Карточка новости">
              <div className="grid gap-4 xl:grid-cols-2">
                <TextField label="Заголовок" value={draft.title} onChange={(title) => set({ title })} />
                <div className="flex flex-col">
                  <Label hint={news.slugLocked ? 'зафиксирован после публикации' : 'латиница, цифры, дефисы'}>
                    Адрес: /news/…/
                  </Label>
                  <div className="relative mt-auto">
                    <input
                      className={cn(inputCls, news.slugLocked && 'bg-gray-100 pr-8 text-gray-500')}
                      aria-label="Адрес новости"
                      value={draft.slug}
                      disabled={news.slugLocked}
                      onChange={(e) => set({ slug: e.target.value.toLowerCase() })}
                    />
                    {news.slugLocked && <Lock size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />}
                  </div>
                </div>
              </div>
              <TextArea label="Анонс" hint="текст карточки в ленте" rows={3} value={draft.lead} onChange={(lead) => set({ lead })} />
              <div className="grid gap-4 xl:grid-cols-3">
                <SelectField label="Рубрика (бейдж)" value={draft.categoryKey ?? ''} options={categoryOptions} onChange={(v) => set({ categoryKey: v || null })} />
                <div className="flex flex-col">
                  <Label hint="ставится при первой публикации">Дата новости</Label>
                  <input
                    type="datetime-local"
                    className={cn(inputCls, 'mt-auto')}
                    aria-label="Дата новости"
                    value={toLocalInput(draft.publishedAt)}
                    onChange={(e) => {
                      const iso = fromLocalInput(e.target.value)
                      if (iso) set({ publishedAt: iso })
                    }}
                  />
                </div>
                <MediaField label="Обложка карточки" hint="пусто — первое фото hero" value={coverUrl(draft.cover)} onChange={(url) => set({ cover: url || null })} />
              </div>
              <div>
                <Label hint="по ним фильтруют ленту">Теги</Label>
                {visibleTags.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    Тегов нет — их заводят в <Link to="/news/dictionaries" className="text-primary-700 hover:underline">рубриках и тегах</Link>.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {visibleTags.map((tag) => {
                      const on = draft.tagKeys.includes(tag.key)
                      return (
                        <button
                          key={tag.key}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleTag(tag.key)}
                          className={cn(
                            'rounded-full border px-3 py-1 text-sm',
                            on ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600 hover:border-gray-400'
                          )}
                        >
                          {tag.nameRu}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </FormSection>

            <FormSection id="news-hero" title="Hero — первый экран">
              <GallerySlidesField
                label="Слайды"
                hint="одно фото — без стрелок, несколько — слайдер; фото и видео"
                value={draft.hero}
                onChange={(hero) => set({ hero })}
              />
            </FormSection>

            <FormSection id="news-sections" title="Блоки страницы">
              <SectionsEditor value={draft.sections} onChange={(sections) => set({ sections })} />
            </FormSection>
          </>
        ) : (
          <NewsTranslationForm draft={draft} locale={locale} onChange={setDraft} />
        )}
      </div>
    </div>
  )
}

