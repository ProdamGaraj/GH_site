import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  fetchLanguages,
  fetchPageTranslations,
  setActiveLocale,
  selectLanguages,
  selectActiveLocale,
  selectTranslationMap,
  selectDefaultLanguage,
  selectNonDefaultLanguages,
} from './translationsSlice'
import { pageApi } from '@/shared/api'
import type { Language } from '@/shared/types/translation'
import type { TranslationMap } from '@/shared/types/translation'

export interface PageTranslationsContext {
  /** pageId реально является страницей (в редакторе блока в useParams лежит id блока). */
  isPage: boolean
  siteId: string | null
  languages: Language[]
  defaultLang: Language | undefined
  nonDefaultLangs: Language[]
  activeLocale: string | null
  activeLang: Language | undefined
  /** Карта переводов активного языка: nodeId → field → value. */
  translationMap: TranslationMap
  /** Сменить активный язык (подгружает его переводы). */
  setLocale: (code: string | null) => void
}

/**
 * Контекст переводов для «мест выбора медиа» (ContentTab, панели слайдов):
 * языки, активный язык, карта переводов и siteId — без необходимости открывать
 * панель «Переводы». В редакторе блока (id не страница) — isPage=false,
 * языковые колонки скрываются, работает только базовый выбор.
 */
export function usePageTranslations(pageId?: string): PageTranslationsContext {
  const dispatch = useAppDispatch()
  const languages = useAppSelector(selectLanguages)
  const activeLocale = useAppSelector(selectActiveLocale)
  const translationMap = useAppSelector(selectTranslationMap)
  const defaultLang = useAppSelector(selectDefaultLanguage)
  const nonDefaultLangs = useAppSelector(selectNonDefaultLanguages)

  const [siteId, setSiteId] = useState<string | null>(null)
  const [isPage, setIsPage] = useState(false)

  // Языки грузим один раз на всё приложение (slice общий).
  useEffect(() => {
    if (languages.length === 0) dispatch(fetchLanguages())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch])

  // pageId может быть id блока (редактор блоков) — тогда getById(страницы) падает,
  // и мы остаёмся в «базовом» режиме без языковых колонок.
  useEffect(() => {
    if (!pageId) {
      setIsPage(false)
      setSiteId(null)
      return
    }
    let cancelled = false
    pageApi
      .getById(pageId)
      .then((p) => {
        if (cancelled) return
        setIsPage(true)
        setSiteId((p as { siteId?: string | null }).siteId ?? null)
      })
      .catch(() => {
        if (!cancelled) {
          setIsPage(false)
          setSiteId(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [pageId])

  // Подгружаем карту переводов активного языка (идемпотентный GET — безопасно
  // при нескольких потребителях хука на странице).
  useEffect(() => {
    if (isPage && pageId && activeLocale) {
      dispatch(fetchPageTranslations({ pageId, locale: activeLocale }))
    }
  }, [dispatch, isPage, pageId, activeLocale])

  const setLocale = (code: string | null) => {
    dispatch(setActiveLocale(code))
  }

  return {
    isPage,
    siteId,
    languages,
    defaultLang,
    nonDefaultLangs,
    activeLocale,
    activeLang: languages.find((l) => l.code === activeLocale),
    translationMap,
    setLocale,
  }
}
