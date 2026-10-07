// Поле слайдов галереи — общее для админок ЖК и новостей: shared/forms/GallerySlidesField.tsx.
import React from 'react'
import { GallerySlidesField } from '@/shared/forms/GallerySlidesField'

export { GallerySlidesField, HERO_FRAMES } from '@/shared/forms/GallerySlidesField'

/**
 * Слайдер страницы проекта: к кадрированию — тема шапки над слайдом и
 * слайд-блок из библиотеки. Шаблон проекта их читает (миграция слайдеров v4,
 * разворот блоков — DeployService.expandDataSlideBlocks); у новостей их нет.
 */
export const ProjectSlidesField: React.FC<React.ComponentProps<typeof GallerySlidesField>> = (props) => (
  <GallerySlidesField withTheme withBlocks {...props} />
)
