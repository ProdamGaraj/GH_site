// Поле слайдов галереи — общее для админок ЖК и новостей: shared/forms/GallerySlidesField.tsx.
import React, { useEffect, useState } from 'react'
import { collectionApi, type TemplateScreen } from '@/shared/api/collectionApi'
import { GallerySlidesField } from '@/shared/forms/GallerySlidesField'

export { GallerySlidesField, HERO_FRAMES } from '@/shared/forms/GallerySlidesField'

/**
 * Экраны страницы-шаблона проектов (брейкпоинты в CMS). Один запрос на
 * модуль: полей слайдов на форме ЖК четыре. Не загрузились — полей медиа по
 * экранам нет, остальная форма работает.
 */
let projectScreens: Promise<TemplateScreen[]> | null = null

function useProjectScreens(): TemplateScreen[] {
  const [screens, setScreens] = useState<TemplateScreen[]>([])
  useEffect(() => {
    let cancelled = false
    projectScreens ??= collectionApi
      .screens('estate')
      .then((r) => r.screens)
      .catch(() => {
        projectScreens = null
        return []
      })
    projectScreens.then((list) => {
      if (!cancelled) setScreens(list)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return screens
}

/**
 * Слайдер страницы проекта: к кадрированию — тема шапки над слайдом,
 * слайд-блок из библиотеки и медиа по экранам шаблона. Шаблон проекта их
 * читает (миграция слайдеров v4, разворот блоков — DeployService.
 * expandDataSlideBlocks, экраны — services/screenMedia.ts); у новостей их нет.
 */
export const ProjectSlidesField: React.FC<React.ComponentProps<typeof GallerySlidesField>> = (props) => {
  const screens = useProjectScreens()
  return <GallerySlidesField withTheme withBlocks screens={screens} {...props} />
}
