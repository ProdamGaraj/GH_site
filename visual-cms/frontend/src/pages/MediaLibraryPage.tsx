import React from 'react'
import { Header } from '@/shared/components/Header'
import { MediaLibrary } from '@/features/media/MediaLibrary'

export const MediaLibraryPage: React.FC = () => {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Медиа-библиотека</h1>
          <p className="text-gray-600 mt-1">
            Все изображения и видео сайта. Загружайте файлы здесь, а затем выбирайте их в блоках.
          </p>
        </div>
        <MediaLibrary kind="any" />
      </div>
    </div>
  )
}
