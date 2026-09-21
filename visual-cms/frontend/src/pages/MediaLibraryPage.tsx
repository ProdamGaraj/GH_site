import React, { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Header } from '@/shared/components/Header'
import { MediaLibrary } from '@/features/media/MediaLibrary'
import { readFolderFromSearch, applyFolderToParams } from '@/features/media/mediaLinks'
import type { FolderSelection } from '@/features/media/MediaFolderTree'

/**
 * Страница медиатеки.
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
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Медиа-библиотека</h1>
          <p className="text-gray-600 mt-1">
            Все изображения, видео и документы (PDF, Office) сайта. Загружайте файлы здесь,
            а затем выбирайте их в блоках или вставляйте ссылку для скачивания.
          </p>
        </div>
        <MediaLibrary
          kind="any"
          shareableLinks
          initialFolder={folder}
          onFolderChange={handleFolderChange}
        />
      </div>
    </div>
  )
}
