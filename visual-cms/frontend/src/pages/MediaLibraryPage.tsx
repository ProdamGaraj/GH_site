import React, { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Header } from '@/shared/components/Header'
import { MediaLibrary } from '@/features/media/MediaLibrary'
import { readFolderFromSearch, applyFolderToParams } from '@/features/media/mediaLinks'
import type { FolderSelection } from '@/features/media/MediaFolderTree'

/**
 * Страница медиатеки.
 *
 * Раскладка в высоту экрана: прокручиваются дерево папок и сетка файлов, каждое
 * само по себе, а страница целиком стоит на месте. Иначе при длинной выдаче
 * панель инструментов и пагинация уезжают наверх, и до них приходится
 * прокручивать всю сетку обратно.
 *
 * Выбранная папка живёт в адресе: по такой ссылке коллега с доступом в панель
 * открывает ту же папку, а не корень. Держит её именно страница — сама
 * MediaLibrary используется ещё и внутри модалок выбора, где адрес ничего
 * не значит и менять его нельзя.
 */
export const MediaLibraryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const folder = readFolderFromSearch(searchParams.toString())

  const handleFolderChange = useCallback(
    (next: FolderSelection) => {
      // replace: смена папки — это не шаг навигации, иначе «назад» превращается
      // в отматывание всех кликов по дереву.
      setSearchParams(applyFolderToParams(searchParams, next), { replace: true })
    },
    [searchParams, setSearchParams]
  )

  return (
    <div className="h-screen flex flex-col">
      <Header />

      {/*
        min-h-0 на растущем потомке обязателен: без него flex-элемент не может
        стать ниже своего содержимого, и прокрутка всё равно уезжает на страницу.
      */}
      <div className="flex-1 min-h-0 overflow-hidden p-8 flex flex-col gap-6">
        <div className="shrink-0">
          <h1 className="text-3xl font-bold text-gray-900">Медиа-библиотека</h1>
          <p className="text-gray-600 mt-1">
            Все изображения, видео и документы (PDF, Office) сайта. Загружайте файлы здесь,
            а затем выбирайте их в блоках или вставляйте ссылку для скачивания.
          </p>
        </div>

        <div className="flex-1 min-h-0">
          <MediaLibrary
            kind="any"
            fillHeight
            shareableLinks
            initialFolder={folder}
            onFolderChange={handleFolderChange}
          />
        </div>
      </div>
    </div>
  )
}
