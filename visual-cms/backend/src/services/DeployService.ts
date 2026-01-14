/**
 * Сервис деплоя страниц - генерирует статические HTML файлы
 */

import * as fs from 'fs'
import * as path from 'path'
import { htmlGenerator } from './HtmlGenerator'
import { AppDataSource } from '../config/database'
import { Page } from '../models/Page'

// Папка для публикации - используем переменную окружения или путь относительно /app
const PUBLIC_DIR = process.env.PUBLIC_SITE_DIR || '/app/public-site'

export interface DeployResult {
  success: boolean
  message: string
  deployedPages: string[]
  errors: string[]
  publicUrl?: string
}

export class DeployService {
  private pageRepository = AppDataSource.getRepository(Page)

  /**
   * Деплоит одну страницу
   */
  async deployPage(pageId: string): Promise<DeployResult> {
    const errors: string[] = []
    const deployedPages: string[] = []

    try {
      const page = await this.pageRepository.findOne({ where: { id: pageId } })
      
      if (!page) {
        return {
          success: false,
          message: 'Страница не найдена',
          deployedPages: [],
          errors: ['Page not found']
        }
      }

      if (!page.structure) {
        return {
          success: false,
          message: 'Страница не имеет структуры',
          deployedPages: [],
          errors: ['Page has no structure']
        }
      }

      // Создаём папку public-site если не существует
      this.ensureDirectoryExists(PUBLIC_DIR)

      // Генерируем HTML
      const html = htmlGenerator.generatePage(
        page.structure,
        page.metadata || { title: page.name, description: '', keywords: [] },
        page.slug
      )

      // Определяем путь файла
      const fileName = page.slug === 'index' || page.slug === 'home' 
        ? 'index.html' 
        : `${page.slug}.html`
      const filePath = path.join(PUBLIC_DIR, fileName)

      // Записываем файл
      fs.writeFileSync(filePath, html, 'utf-8')
      deployedPages.push(fileName)

      // Обновляем статус страницы
      page.status = 'published'
      await this.pageRepository.save(page)

      console.log(`✅ Deployed: ${fileName}`)

      return {
        success: true,
        message: `Страница "${page.name}" успешно опубликована`,
        deployedPages,
        errors,
        publicUrl: `http://localhost:3001/${fileName}`
      }
    } catch (error: any) {
      console.error('Deploy error:', error)
      return {
        success: false,
        message: 'Ошибка при публикации',
        deployedPages,
        errors: [error.message]
      }
    }
  }

  /**
   * Деплоит все опубликованные страницы
   */
  async deployAll(): Promise<DeployResult> {
    const errors: string[] = []
    const deployedPages: string[] = []

    try {
      const pages = await this.pageRepository.find({
        where: { status: 'published' }
      })

      if (pages.length === 0) {
        return {
          success: false,
          message: 'Нет опубликованных страниц для деплоя',
          deployedPages: [],
          errors: []
        }
      }

      // Создаём папку public-site
      this.ensureDirectoryExists(PUBLIC_DIR)

      // Копируем assets (шрифты, изображения)
      this.copyAssets()

      for (const page of pages) {
        if (!page.structure) {
          errors.push(`Страница "${page.name}" не имеет структуры`)
          continue
        }

        try {
          const html = htmlGenerator.generatePage(
            page.structure,
            page.metadata || { title: page.name, description: '', keywords: [] },
            page.slug
          )

          const fileName = page.slug === 'index' || page.slug === 'home' 
            ? 'index.html' 
            : `${page.slug}.html`
          const filePath = path.join(PUBLIC_DIR, fileName)

          fs.writeFileSync(filePath, html, 'utf-8')
          deployedPages.push(fileName)
          console.log(`✅ Deployed: ${fileName}`)
        } catch (err: any) {
          errors.push(`Ошибка при генерации "${page.name}": ${err.message}`)
        }
      }

      return {
        success: errors.length === 0,
        message: `Опубликовано ${deployedPages.length} страниц`,
        deployedPages,
        errors,
        publicUrl: 'http://localhost:3001/'
      }
    } catch (error: any) {
      return {
        success: false,
        message: 'Ошибка при публикации',
        deployedPages,
        errors: [error.message]
      }
    }
  }

  /**
   * Получает список опубликованных файлов
   */
  getDeployedFiles(): string[] {
    if (!fs.existsSync(PUBLIC_DIR)) {
      return []
    }
    return fs.readdirSync(PUBLIC_DIR).filter(f => f.endsWith('.html'))
  }

  /**
   * Удаляет опубликованный файл
   */
  async undeployPage(slug: string): Promise<boolean> {
    const fileName = slug === 'index' || slug === 'home' ? 'index.html' : `${slug}.html`
    const filePath = path.join(PUBLIC_DIR, fileName)
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      return true
    }
    return false
  }

  /**
   * Создаёт директорию если не существует
   */
  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  /**
   * Копирует статические ресурсы
   */
  private copyAssets(): void {
    // Создаём папки для assets
    const fontsDir = path.join(PUBLIC_DIR, 'fonts')
    const imagesDir = path.join(PUBLIC_DIR, 'images')
    const cssDir = path.join(PUBLIC_DIR, 'css')

    this.ensureDirectoryExists(fontsDir)
    this.ensureDirectoryExists(imagesDir)
    this.ensureDirectoryExists(cssDir)

    // TODO: Копировать реальные шрифты из assets
    // Пока создаём placeholder
    const readmePath = path.join(PUBLIC_DIR, 'README.txt')
    fs.writeFileSync(readmePath, `
Golden House - Public Site
==========================

Сгенерировано: ${new Date().toISOString()}

Структура:
- *.html - страницы сайта
- /fonts - шрифты Muller
- /images - изображения
- /css - стили (если есть)

Для просмотра запустите: npx serve public-site -p 3001
    `.trim(), 'utf-8')
  }
}

export const deployService = new DeployService()
